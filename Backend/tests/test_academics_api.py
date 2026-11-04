import unittest

from http_harness import ApiServer


class AcademicApiTests(unittest.TestCase):
    def test_teacher_cannot_read_another_assigned_class(self):
        with ApiServer() as api:
            teacher1 = api.request("POST", "/api/auth/users", {"username": "teacher1", "password": "teacher-password-123", "role": "teacher"})[1]
            teacher2 = api.request("POST", "/api/auth/users", {"username": "teacher2", "password": "teacher-password-456", "role": "teacher"})[1]
            token = api.request("POST", "/api/auth/login", {"username": "teacher1", "password": "teacher-password-123"}, auth=False)[1]["accessToken"]
            own = api.request("POST", "/api/classes", {"name": "Math", "code": "MATH-1", "teacherUserId": teacher1["id"]})[1]
            other = api.request("POST", "/api/classes", {"name": "History", "code": "HIST-1", "teacherUserId": teacher2["id"]})[1]
            api.request("POST", "/api/students", {"id": "ST-01", "name": "Ada Lovelace", "classId": own["id"]})
            api.request("POST", "/api/students", {"id": "ST-02", "name": "Grace Hopper", "classId": other["id"]})
            self.assertEqual(len(api.request("GET", "/api/classes", token=token)[1]), 1)
            self.assertEqual(len(api.request("GET", "/api/students", token=token)[1]), 1)
            self.assertEqual(api.request("GET", "/api/students/ST-02", token=token)[0], 403)
            self.assertEqual(api.request("GET", f"/api/classes/{other['id']}", token=token)[0], 403)

    def test_classes_courses_and_assignment(self):
        with ApiServer() as api:
            status, school_class, _ = api.request("POST", "/api/classes", {
                "name": "Computer Science 101", "code": "CS-101", "teacher": "Dr. Ada", "room": "B-204"
            })
            self.assertEqual(status, 201)
            class_id = school_class["id"]
            self.assertEqual(api.request("POST", "/api/classes", {"name": "Duplicate", "code": "CS-101"})[0], 409)
            status, course, _ = api.request("POST", "/api/courses", {
                "classId": class_id, "name": "Programming", "code": "CS101-A", "schedule": "Monday 09:00"
            })
            self.assertEqual(status, 201)
            self.assertEqual(api.request("POST", "/api/students", {"id": "ST-01", "name": "Ada Lovelace"})[0], 201)
            self.assertEqual(api.request("PUT", f"/api/classes/{class_id}/students/ST-01")[0], 200)
            status, details, _ = api.request("GET", f"/api/classes/{class_id}")
            self.assertEqual((details["studentCount"], details["courseCount"]), (1, 1))
            self.assertEqual(api.request("GET", f"/api/courses?classId={class_id}")[1][0]["id"], course["id"])
            self.assertEqual(api.request("DELETE", f"/api/classes/{class_id}/students/ST-01")[0], 204)
            self.assertEqual(api.request("DELETE", f"/api/courses/{course['id']}")[0], 204)
            self.assertEqual(api.request("DELETE", f"/api/classes/{class_id}")[0], 204)


if __name__ == "__main__":
    unittest.main()
