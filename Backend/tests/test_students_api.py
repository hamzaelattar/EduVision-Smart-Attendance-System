import unittest

from http_harness import ApiServer


class StudentApiTests(unittest.TestCase):
    def test_auth_crud_search_and_pagination(self):
        with ApiServer() as api:
            self.assertEqual(api.request("GET", "/api/students", auth=False)[0], 401)
            status, student, _ = api.request("POST", "/api/students", {"id": "ST-01", "name": "Ada Lovelace"})
            self.assertEqual(status, 201)
            self.assertEqual(student["firstName"], "Ada")
            self.assertEqual(api.request("POST", "/api/students", {"id": "ST-01", "name": "Duplicate"})[0], 409)
            self.assertEqual(api.request("POST", "/api/students", {"id": "ST-02", "firstName": "Grace", "lastName": "Hopper", "email": "grace@example.org"})[0], 201)
            status, listing, headers = api.request("GET", "/api/students?q=grace&limit=1&offset=0")
            self.assertEqual(status, 200)
            self.assertEqual(headers["X-Total-Count"], "1")
            self.assertEqual(listing[0]["id"], "ST-02")
            status, updated, _ = api.request("PUT", "/api/students/ST-01", {"firstName": "Augusta", "lastName": "Lovelace"})
            self.assertEqual(status, 200)
            self.assertEqual(updated["name"], "Augusta Lovelace")
            self.assertEqual(api.request("DELETE", "/api/students/ST-02")[0], 204)
            self.assertEqual(api.request("GET", "/api/students/ST-02")[0], 404)


if __name__ == "__main__":
    unittest.main()
