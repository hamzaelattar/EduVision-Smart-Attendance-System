import unittest

from http_harness import ApiServer


class CameraApiTests(unittest.TestCase):
    def test_camera_credentials_assignment_and_access(self):
        with ApiServer() as api:
            self.assertEqual(api.request("GET", "/api/webrtc/cameras", auth=False)[0], 401)
            self.assertEqual(api.request("GET", "/api/webrtc/metrics", auth=False)[0], 401)
            self.assertIn("cpuPercent", api.request("GET", "/api/webrtc/metrics")[1])
            status, created, _ = api.request("POST", "/api/webrtc/cameras", {
                "id": "CAM-001", "name": "Salle A", "room": "A1",
            })
            self.assertEqual(status, 201)
            secret = created["deviceSecret"]
            self.assertGreaterEqual(len(secret), 40)
            listing = api.request("GET", "/api/webrtc/cameras")[1]
            self.assertEqual(listing[0]["id"], "CAM-001")
            self.assertNotIn("deviceSecret", listing[0])
            self.assertNotIn("secretHash", listing[0])
            teacher = api.request("POST", "/api/auth/users", {
                "username": "prof", "password": "teacher-password-123", "role": "teacher",
            })[1]
            teacher_token = api.request("POST", "/api/auth/login", {
                "username": "prof", "password": "teacher-password-123",
            }, auth=False)[1]["accessToken"]
            self.assertEqual(api.request("GET", "/api/webrtc/cameras", token=teacher_token)[1], [])
            school_class = api.request("POST", "/api/classes", {
                "name": "Classe A", "code": "A", "teacherUserId": teacher["id"],
            })[1]
            course = api.request("POST", "/api/courses", {
                "classId": school_class["id"], "name": "Cours A", "code": "A1",
            })[1]
            session = api.request("POST", "/api/sessions", {
                "classId": school_class["id"], "courseId": course["id"],
            }, token=teacher_token)[1]
            self.assertEqual(api.request("PUT", "/api/webrtc/cameras/CAM-001/session", {
                "sessionId": session["id"],
            }, token=teacher_token)[0], 403)
            self.assertEqual(api.request("PUT", "/api/webrtc/cameras/CAM-001/session", {
                "sessionId": session["id"],
            })[0], 200)
            self.assertEqual(api.request("GET", "/api/webrtc/cameras", token=teacher_token)[1][0]["id"], "CAM-001")
            offer = {"cameraId": "CAM-001", "sdp": "invalid", "type": "offer"}
            self.assertEqual(api.request("POST", "/api/webrtc/offer", offer, auth=False)[0], 401)
            self.assertEqual(api.request("POST", "/api/webrtc/offer", offer, auth=False,
                                         extra_headers={"X-Camera-Secret": "wrong"})[0], 401)
            self.assertEqual(api.request("POST", "/api/webrtc/offer", offer, auth=False,
                                         extra_headers={"X-Camera-Secret": secret})[0], 422)
            rotated = api.request("POST", "/api/webrtc/cameras/CAM-001/rotate-secret")[1]
            self.assertNotEqual(rotated["deviceSecret"], secret)
            self.assertEqual(api.request("PUT", "/api/webrtc/cameras/CAM-001/enabled", {"enabled": False})[1]["enabled"], False)
            self.assertEqual(api.request("POST", "/api/webrtc/offer", offer, auth=False,
                                         extra_headers={"X-Camera-Secret": rotated["deviceSecret"]})[0], 401)
