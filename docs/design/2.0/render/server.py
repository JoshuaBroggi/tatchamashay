import http.server, os, sys, base64, urllib.parse
HERE=os.path.dirname(os.path.abspath(__file__)); REPO=os.path.abspath(os.path.join(HERE,'../../../..'))
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, p):
        p=urllib.parse.unquote(p.split('?')[0])
        if p.startswith('/nm/'): return REPO+'/node_modules/'+p[4:]
        if p.startswith('/models/'): return REPO+'/public/models/'+p[8:]
        if p.startswith('/design/'): return os.path.dirname(HERE)+'/'+p[8:]
        return HERE+p
    def do_POST(self):
        n=os.path.basename(self.path); d=self.rfile.read(int(self.headers['Content-Length'])).decode()
        open(os.path.join(HERE,'out',n) if os.makedirs(os.path.join(HERE,'out'),exist_ok=True) is None else '','wb').write(base64.b64decode(d.split(',')[1]))
        self.send_response(200); self.send_header('Access-Control-Allow-Origin','*'); self.end_headers(); self.wfile.write(b'ok')
http.server.ThreadingHTTPServer(('127.0.0.1',8765),H).serve_forever()
