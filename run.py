import http.server
import sys
import json

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'max-age=0')
        self.send_header('Expires', '0')
        super().end_headers()

with open("config/config.json")as f:
    config = json.load(f)

frontend_port = config["frontend"]["port"]

print(f"Server is launched on {frontend_port}")
httpServer = http.server.HTTPServer(('', frontend_port), NoCacheHTTPRequestHandler)
httpServer.serve_forever()
