import asyncio
import json
import unittest

from websockets.asyncio.client import connect
from websockets.exceptions import InvalidStatus

from http_harness import ApiServer


class RecognitionWebSocketTests(unittest.TestCase):
    def test_auth_origin_and_invalid_frame_handling(self):
        with ApiServer() as api:
            class_id = api.request("POST", "/api/classes", {"name": "Math", "code": "MATH-1"})[1]["id"]
            course_id = api.request("POST", "/api/courses", {"classId": class_id, "name": "Algebra", "code": "ALG-1"})[1]["id"]
            session_id = api.request("POST", "/api/sessions", {"classId": class_id, "courseId": course_id})[1]["id"]
            url = api.base_url.replace("http:", "ws:") + "/ws/recognition"

            async def exercise():
                with self.assertRaises(InvalidStatus):
                    async with connect(url, origin="http://evil.example", additional_headers={"Authorization": f"Bearer {api.token}"}):
                        pass
                with self.assertRaises(InvalidStatus):
                    async with connect(url, origin="http://127.0.0.1:5173"):
                        pass
                async with connect(url, origin="http://127.0.0.1:5173", additional_headers={"Authorization": f"Bearer {api.token}"}) as socket:
                    ready = json.loads(await socket.recv())
                    self.assertEqual(ready["attendanceDecisions"], "manual-only")
                    await socket.send(json.dumps({"type": "frame", "sessionId": session_id, "sequence": 1, "image": "bad-image"}))
                    error = json.loads(await socket.recv())
                    self.assertEqual(error["code"], "invalidImage")

            asyncio.run(exercise())


if __name__ == "__main__":
    unittest.main()
