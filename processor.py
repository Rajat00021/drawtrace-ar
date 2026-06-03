import cv2
import os
import time
import shutil

def process_video(video_path, output_path, style="ghibli"):
    """
    AI Rotoscoping Engine: Transforms real video into stylized animation.
    """
    print(f"Starting processing for: {video_path}")
    
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Define the codec and create VideoWriter object
    # Try H.264 first (browser-compatible), fallback to mp4v
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    if not out.isOpened():
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # --- Rotoscoping Logic (Cartoon Filter) ---
        # 1. Reduce noise using bilateral filter (keeps edges sharp)
        color = cv2.bilateralFilter(frame, d=9, sigmaColor=75, sigmaSpace=75)
        
        # 2. Convert to grayscale and apply median blur
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.medianBlur(gray, 7)
        
        # 3. Detect edges (Rotoscoping outlines)
        edges = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 2)
        
        # 4. Combine color and edges
        cartoon = cv2.bitwise_and(color, color, mask=edges)

        # Optional: Add a slight warmth/coolness based on style
        if style == "ghibli":
            # Add a slight warm tint
            cartoon = cv2.addWeighted(cartoon, 0.9, cartoon, 0.1, 10)

        out.write(cartoon)
        
        count += 1
        if count % 30 == 0:
            print(f"Transformed {count}/{frame_count} frames...")

    cap.release()
    out.release()
    print("Video conversion complete!")
    return output_path

if __name__ == "__main__":
    # Example usage
    process_video("input.mp4", "output.mp4")
