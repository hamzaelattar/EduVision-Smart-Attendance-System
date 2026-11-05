"""Loopback media test: two publishers stay isolated and can be viewed."""

import asyncio
import unittest

from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from av import VideoFrame

from http_harness import ApiServer


class BlackVideo(VideoStreamTrack):
    async def recv(self):
        pts, time_base = await self.next_timestamp()
        frame = VideoFrame(width=320, height=240, format="yuv420p")
        frame.pts = pts
        frame.time_base = time_base
        return frame


async def gathered(pc):
    for _ in range(150):
        if pc.iceGatheringState == "complete":
            return
        await asyncio.sleep(0.1)
    raise AssertionError("ICE gathering timed out")


class WebRTCMediaTests(unittest.TestCase):
    def test_two_cameras_publish_and_view(self):
        with ApiServer() as api:
            secrets = {}
            for camera_id in ("CAM-001", "CAM-002"):
                status, created, _ = api.request("POST", "/api/webrtc/cameras", {
                    "id": camera_id, "name": camera_id,
                })
                self.assertEqual(status, 201)
                secrets[camera_id] = created["deviceSecret"]
            asyncio.run(self._exercise(api, secrets))

    async def _exercise(self, api, secrets):
        peers = []
        try:
            for camera_id, secret in secrets.items():
                publisher = RTCPeerConnection()
                peers.append(publisher)
                publisher.addTrack(BlackVideo())
                await publisher.setLocalDescription(await publisher.createOffer())
                await gathered(publisher)
                status, answer, _ = await asyncio.to_thread(api.request, "POST", "/api/webrtc/offer", {
                    "cameraId": camera_id, "sdp": publisher.localDescription.sdp,
                    "type": publisher.localDescription.type,
                }, False, None, {"X-Camera-Secret": secret})
                self.assertEqual(status, 200, answer)
                await publisher.setRemoteDescription(RTCSessionDescription(sdp=answer["sdp"], type=answer["type"]))

            for _ in range(60):
                cameras = (await asyncio.to_thread(api.request, "GET", "/api/webrtc/cameras"))[1]
                if len(cameras) == 2 and all(camera["online"] for camera in cameras):
                    break
                await asyncio.sleep(0.1)
            else:
                self.fail("Both cameras did not become online")

            for camera_id in secrets:
                viewer = RTCPeerConnection()
                peers.append(viewer)
                tracks = []

                @viewer.on("track")
                def on_track(track):
                    tracks.append(track)

                viewer.addTransceiver("video", direction="recvonly")
                await viewer.setLocalDescription(await viewer.createOffer())
                await gathered(viewer)
                status, answer, _ = await asyncio.to_thread(api.request, "POST", f"/api/webrtc/cameras/{camera_id}/view", {
                    "sdp": viewer.localDescription.sdp, "type": viewer.localDescription.type,
                })
                self.assertEqual(status, 200, answer)
                await viewer.setRemoteDescription(RTCSessionDescription(sdp=answer["sdp"], type=answer["type"]))
                self.assertEqual(len(tracks), 1)
                frame = await asyncio.wait_for(tracks[0].recv(), timeout=8)
                self.assertEqual((frame.width, frame.height), (320, 240))
        finally:
            for peer in peers:
                await peer.close()
