import { useState, useEffect, useRef, useCallback } from "react";

import {
  X,
  AlertTriangle,
  Loader,
  CheckCircle,
  Trash2,
  Camera,

  Video,
  RefreshCw,
} from "lucide-react";

// --- INTERFACES ---

interface MessageBoxProps {
  type: "success" | "error" | "info" | null;
  message: string | null;
  onClose: () => void;
}

interface Prediction {
  class: string;
  confidence: number;
}

interface MessageState {
  type: "success" | "error" | "info" | null;
  text: string | null;
}

interface HistoryItem {
  image: string | ArrayBuffer | null;
  prediction: Prediction;
}

type FacingMode = 'user' | 'environment';
const FALLBACK_IMAGE_URL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"%3E%3Crect width="300" height="200" fill="%23f0f0f0"/%3E%3Cline x1="0" y1="0" x2="300" y2="200" stroke="%23ccc" stroke-width="2"/%3E%3Cline x1="300" y1="0" x2="0" y2="200" stroke="%23ccc" stroke-width="2"/%3E%3Ctext x="150" y="105" font-size="20" fill="%23666" text-anchor="middle"%3EImage Placeholder%3C/text%3E%3C/svg%3E';

// --- MESSAGE BOX COMPONENT (Unchanged) ---

const MessageBox: React.FC<MessageBoxProps> = ({ type, message, onClose }) => {
  if (!message) return null;

  const baseClasses =
    "fixed mt-16 top-4 right-4 p-4 rounded-lg shadow-xl flex items-center space-x-3 transition-transform duration-300 z-50";
  let colorClasses = "";
  let Icon: React.ElementType = AlertTriangle;

  switch (type) {
    case "success":
      colorClasses = "bg-green-100 border border-green-400 text-green-700";
      Icon = CheckCircle;
      break;
    case "error":
      colorClasses = "bg-red-100 border border-red-400 text-red-700";
      Icon = X;
      break;
    case "info":
    default:
      colorClasses = "bg-yellow-100 border border-yellow-400 text-yellow-700";
      Icon = AlertTriangle;
      break;
  }

  return (
    <div className={`${baseClasses} ${colorClasses}`} role="alert">
      <Icon className="w-6 h-6 shrink-0" />
      <span className="font-medium wrap-break-words">{message}</span>
      <button
        onClick={onClose}
        className="ml-4 text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-white/50"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// --- MAIN COMPONENT ---

const Part2: React.FC = () => {
  // State
  const [imageUrl, setImageUrl] = useState<string | null>(FALLBACK_IMAGE_URL);
  const [classification, setClassification] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string>(''); // For camera/file errors
  
  // Camera State
  const [isCameraMode, setIsCameraMode] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<FacingMode>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null); // Use ref for stream management

  // --- UTILITY FUNCTIONS ---

  const showMessage = useCallback(
    (type: "success" | "error" | "info" | null, text: string) => {
      setMessage({ type, text });
      const timeoutId = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timeoutId);
    },
    []
  );
  
  // --- CORE CAMERA CONTROL LOGIC (Provided) ---
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async (mode: FacingMode) => {
    setError('');
    setLoading(true); // Set loading while requesting camera
    stopCamera(); 
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        const videoElement = videoRef.current;
        videoElement.srcObject = stream;

        // Wait for video metadata to load before playing (more reliable)
        await new Promise<void>((resolve) => {
          const handleLoadedMetadata = () => {
            videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
            resolve();
          };
          videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        });
        
        await videoElement.play(); 
        setIsCameraMode(true);
        setCameraFacingMode(mode); 
        setImageUrl(FALLBACK_IMAGE_URL); // Reset image state
        setLoading(false); // Stop loading after successful stream start
      }
    } catch (e) {
      console.error("Camera access failed:", e);
      setError(`Could not access camera (${mode} mode). Please check browser permissions.`);
      setIsCameraMode(false); 
      setLoading(false); // Stop loading on failure
    }
  }, [stopCamera]);

  // --- CORE CAMERA CAPTURE LOGIC (Provided) ---
  const captureImage = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      setError("Camera or canvas not ready for capture.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip the image if it's the front camera
    ctx.save(); 
    if (cameraFacingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore(); 

    const base64DataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    setImageUrl(base64DataUrl);
    setClassification(null);
    stopCamera(); // Stop the camera after capturing
    setIsCameraMode(false); 
    
    // Immediately classify the captured image
    handleClassify(base64DataUrl);
  }, [cameraFacingMode, stopCamera]);


  // --- CLASSIFICATION LOGIC (Adapted) ---

  const handleClassify = useCallback(
    async (imageDataToClassify: string) => {
      if (imageDataToClassify === FALLBACK_IMAGE_URL) {
          showMessage("info", "Please select or capture an image first.");
          return;
      }
      setLoading(true);
      setClassification(null);
      setMessage(null);

      try {
        const res = await fetch(
          "https://ecowaste-ai-backend.onrender.com/api/classify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageData: imageDataToClassify }),
          }
        );

        const data = await res.json();

        if (!res.ok) {
          const errorMessage = data.error || "An unknown classification error occurred.";
          showMessage("error", errorMessage);
          return;
        }

        const predictions: Prediction[] = data.results?.predictions || [];
        if (predictions.length === 0) {
          showMessage("error", "No predictions returned.");
          return;
        }
        const topPrediction = predictions.reduce((prev, curr) =>
          curr.confidence > prev.confidence ? curr : prev
        );

        setClassification(topPrediction);
        showMessage("success", "Image classified successfully!");

        // Update recent history
        setHistory((prevHistory) => {
          const newHistory = [
            { image: imageDataToClassify, prediction: topPrediction },
            ...prevHistory,
          ];
          return newHistory.slice(0, 5);
        });
      } catch (err) {
        showMessage("error", "Failed to connect to the backend server.");
      } finally {
        setLoading(false);
      }
    },
    [showMessage]
  );

  // --- UI ACTION HANDLERS (Provided/Adapted) ---

  const toggleCameraFacingMode = useCallback(() => {
    setCameraFacingMode(prevMode => (prevMode === 'environment' ? 'user' : 'environment'));
  }, []);
    
  const handleStartCameraMode = () => {
    setError('');
    setClassification(null);
    setIsCameraMode(true);
  };

  const handleCloseCamera = () => {
    setIsCameraMode(false);
  }
    
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (isCameraMode) {
        stopCamera();
        setIsCameraMode(false);
    }

    if (file && file.type.startsWith('image/')) {
        setError('');
        setClassification(null);
            
        const reader = new FileReader();
        reader.onloadend = () => {
            setImageUrl(reader.result as string); 
        };
        reader.readAsDataURL(file);
    } else {
        setImageUrl(FALLBACK_IMAGE_URL); 
        setError('Please select a valid image file (PNG, JPG, etc.).');
    }
  };

  const handleManualClassify = () => {
    if (imageUrl) {
        handleClassify(imageUrl);
    }
  }

  const handleDeleteHistory = (index: number) => {
    const newHistory = [...history];
    newHistory.splice(index, 1);
    setHistory(newHistory);
  };

  // --- EFFECTS ---

  // 1. Initial camera check to determine facing mode and multiple cameras
  useEffect(() => {
    const checkCameras = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
        
        // Default to 'user' if only one camera is found (often front on desktop)
        if (videoInputs.length <= 1) setCameraFacingMode('user');
        // Default to 'environment' if multiple are found (common on mobile)
        else setCameraFacingMode('environment');

      } catch (e) {
        console.error("Error enumerating devices:", e);
      }
    };
    checkCameras();
  }, []); 

  // 2. Camera control based on isCameraMode and cameraFacingMode change
  useEffect(() => {
    if (isCameraMode) {
      startStream(cameraFacingMode);
    } else {
      stopCamera();
    }
    // Cleanup on unmount/re-run
    return () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
    };
  }, [isCameraMode, cameraFacingMode, startStream, stopCamera]); 

  // 3. Load/Save history from localStorage
  useEffect(() => {
    const storedHistory = localStorage.getItem("recentHistory");
    if (storedHistory) setHistory(JSON.parse(storedHistory));
  }, []);

  useEffect(() => {
    localStorage.setItem("recentHistory", JSON.stringify(history));
  }, [history]);

  // --- RENDER ---

  const isClassifyDisabled = loading || (isCameraMode ? !streamRef.current : imageUrl === FALLBACK_IMAGE_URL);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-8">
      <div className="max-w-xl mx-auto bg-white p-6 sm:p-10 rounded-xl shadow-2xl border border-gray-100">
        <h1 className="text-4xl font-extrabold mb-6 text-center text-green-700">
          ♻️ Waste AI Classifier
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Use your **camera** or **upload** an image to classify waste.
        </p>

        {/* --- Camera / Upload Toggle --- */}
        <div className="flex justify-center space-x-4 mb-8">
          <button
            onClick={isCameraMode ? handleCloseCamera : handleStartCameraMode}
            className={`flex items-center space-x-2 py-2 px-4 rounded-full text-sm font-semibold transition ${
              isCameraMode
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            {isCameraMode ? (
              <Video className="w-5 h-5" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
            <span>{isCameraMode ? "Stop Camera" : "Use Camera"}</span>
          </button>
          
          {hasMultipleCameras && isCameraMode && (
            <button
              onClick={toggleCameraFacingMode}
              className="flex items-center space-x-2 py-2 px-4 rounded-full text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Switch to {cameraFacingMode === 'user' ? 'Rear' : 'Front'}</span>
            </button>
          )}

        </div>

        {/* --- Camera / File Input / Preview Area --- */}
        <div className="flex flex-col items-center space-y-6">
          
          {/* File Input (Shown only when not in camera mode) */}
          {!isCameraMode && (
            <input
              key="file-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
          )}

          {/* Video Stream / Image Preview */}
          <div className="relative w-full max-w-sm rounded-lg overflow-hidden shadow-lg border-2 border-gray-200 bg-black aspect-video flex justify-center items-center">
            
            {/* Camera View */}
            {isCameraMode ? (
              <>
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 bg-black/50">
                    <Loader className="w-8 h-8 animate-spin mb-2" />
                    <p>Requesting camera access...</p>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </>
            ) : (
              /* Image Preview View */
              <img
                src={imageUrl || FALLBACK_IMAGE_URL}
                alt="Preview"
                className="w-full h-full object-contain bg-white"
              />
            )}
          </div>
          
          {/* Classification Button */}
          <button
            onClick={isCameraMode ? captureImage : handleManualClassify}
            className={`w-full py-3 px-6 text-lg font-bold rounded-full shadow-lg transition duration-200 flex items-center justify-center space-x-2 ${
              isClassifyDisabled
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
            disabled={isClassifyDisabled}
          >
            {loading && <Loader className="w-5 h-5 animate-spin" />}
            <span>
              {loading
                ? "Classifying..."
                : isCameraMode
                ? "Capture & Classify"
                : "Classify Waste"}
            </span>
          </button>
        </div>

        {/* --- Classification Result --- */}
        {classification && (
          <div className="mt-10 pt-6 border-t border-gray-200">
            <h3 className="text-2xl font-bold mb-4 text-green-600">
              Classification Result
            </h3>
            <div className="p-3 bg-green-50 rounded-lg shadow-inner mb-2">
              <p className="font-semibold text-gray-700">
                Label:{" "}
                <span className="text-green-600 font-extrabold">
                  {classification.class.toUpperCase()}
                </span>
              </p>
              <p className="text-sm text-gray-500">
                Confidence: {(classification.confidence * 100).toFixed(2)}%
              </p>
            </div>
          </div>
        )}

        {/* --- Recent History --- */}
        {history.length > 0 && (
          <>
            <hr className="my-8" />
            <div className="pt-2">
              <h3 className="text-2xl font-bold mb-4 text-gray-700">
                Recent History (Max 5)
              </h3>
              <div className="flex space-x-4 overflow-x-auto pb-4">
                {history.map((item, index) => (
                  <div
                    key={index}
                    className="relative min-w-[180px] bg-gray-50 rounded-lg shadow p-2 shrink-0 border border-gray-200"
                  >
                    <img
                      src={typeof item.image === "string" ? item.image : ""}
                      alt="Recent Classification"
                      className="w-full h-28 object-cover rounded"
                      loading="lazy"
                    />
                    <div className="mt-2 text-sm font-bold text-gray-700 text-center">
                      {item.prediction.class}
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      {(item.prediction.confidence * 100).toFixed(2)}%
                    </div>
                    <button
                      onClick={() => handleDeleteHistory(index)}
                      className="absolute top-1 right-1 text-red-500 hover:text-red-700 bg-white/70 p-1 rounded-full"
                      title="Delete History Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Display internal error state AND external message state */}
      <MessageBox
        type={error ? "error" : message?.type || null}
        message={error || message?.text || null}
        onClose={() => { setError(''); setMessage(null); }}
      />
    </div>
  );
};

export default Part2;



















