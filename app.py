from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI()

# Serve the main frontend
@app.get("/")
async def serve_frontend():
    return FileResponse(os.path.join(os.path.dirname(__file__), "index.html"))

# Mount everything (css, js, assets) from the same directory
app.mount("/", StaticFiles(directory=os.path.dirname(__file__) or "."), name="static")

if __name__ == "__main__":
    import uvicorn
    print("\n AR Tracing Studio is running!")
    print(">> Open in browser: http://localhost:8000")
    print(">> On your phone (same Wi-Fi): http://<your-local-ip>:8000\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
