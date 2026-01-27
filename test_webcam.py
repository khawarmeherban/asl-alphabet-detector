"""
Simple webcam test script to verify OpenCV and webcam are working
"""
import cv2
import sys

print("Testing webcam access...")
print("="*60)

# Try to open webcam with DirectShow (Windows)
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not cap.isOpened():
    print("DirectShow failed, trying default method...")
    cap = cv2.VideoCapture(0)
    
if not cap.isOpened():
    print("ERROR: Cannot access webcam!")
    print("\nTroubleshooting:")
    print("1. Make sure your webcam is connected")
    print("2. Close any other applications using the webcam (Zoom, Teams, etc.)")
    print("3. Check Windows Camera privacy settings")
    sys.exit(1)

print("✓ Webcam opened successfully!")
print("\nDisplaying webcam feed...")
print("Press 'q' or ESC to quit")
print("="*60)

# Create window
cv2.namedWindow('Webcam Test', cv2.WINDOW_NORMAL)

frame_count = 0
while True:
    ret, frame = cap.read()
    
    if not ret:
        print("ERROR: Failed to capture frame")
        break
    
    frame_count += 1
    
    # Flip for mirror effect
    frame = cv2.flip(frame, 1)
    
    # Add text overlay
    cv2.putText(frame, f"Webcam Test - Frame {frame_count}", 
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    cv2.putText(frame, "Press 'q' or ESC to quit", 
                (10, frame.shape[0] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    
    # Display frame
    cv2.imshow('Webcam Test', frame)
    
    # Check for quit
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q') or key == 27:  # q or ESC
        print(f"\nTest completed! Captured {frame_count} frames")
        break
    
    # Check if window was closed
    try:
        if cv2.getWindowProperty('Webcam Test', cv2.WND_PROP_VISIBLE) < 1:
            break
    except:
        break

# Cleanup
cap.release()
cv2.destroyAllWindows()
print("Webcam test finished successfully!")
