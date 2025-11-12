import { useState} from "react";
import type { ChangeEvent } from "react";
import { X, AlertTriangle, Loader, CheckCircle } from "lucide-react";

// ✅ MessageBox props interface
interface MessageBoxProps {
  type: "success" | "error" | "info" | null;
  message: string | null;
  onClose: () => void;
}

// Custom MessageBox component
const MessageBox: React.FC<MessageBoxProps> = ({ type, message, onClose }) => {
  if (!message) return null;

  const baseClasses =
    "fixed top-4 right-4 p-4 rounded-lg shadow-xl flex items-center space-x-3 transition-transform duration-300";
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

// ✅ Roboflow prediction interface
interface Prediction {
  class: string;
  confidence: number;
}

// ✅ Message state interface
interface MessageState {
  type: "success" | "error" | "info" | null;
  text: string | null;
}

const Part2: React.FC = () => {
  const [image, setImage] = useState<string | ArrayBuffer | null>(null);
  const [result, setResult] = useState<Prediction[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<MessageState | null>(null);

  const showMessage = (type: "success" | "error" | "info" | null, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showMessage("error", "File size exceeds the 10MB limit.");
      e.target.value = "";
      setImage(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result);
    reader.readAsDataURL(file);
    setResult(null);
  };

  const handleClassify = async () => {
    if (!image) {
      showMessage("info", "Please upload an image first.");
      return;
    }

    setLoading(true);
    setResult(null);
    setMessage(null);

    try {
      const res = await fetch(
        "https://backend-blush-three-91.vercel.app/api/classify", // ✅ deployed backend URL
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData: image }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error || "An unknown classification error occurred.";
        showMessage("error", errorMessage);
        console.error("Classification API Error:", data.details || data);
        return;
      }

      // Roboflow response usually has predictions array
      setResult(data.results?.predictions || []);
      showMessage("success", "Image classified successfully!");
    } catch (err) {
      console.error("Classification error:", err);
      showMessage("error", "Failed to connect to the backend server.");
    } finally {
      setLoading(false);
    }
  };

  const formatResults = (res: Prediction[] | null) => {
    if (!res || !Array.isArray(res)) return "No data returned.";
    return res.map((item, index) => (
      <div key={index} className="p-3 bg-gray-50 rounded-lg shadow-sm mb-2">
        <p className="font-semibold text-gray-700">
          Label: <span className="text-green-600">{item.class}</span>
        </p>
        <p className="text-sm text-gray-500">
          Confidence: {(item.confidence * 100).toFixed(2)}%
        </p>
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-8">
      <div className="max-w-xl mx-auto bg-white p-6 sm:p-10 rounded-xl shadow-2xl border border-gray-100">
        <h1 className="text-4xl font-extrabold mb-6 text-center text-green-700">
          ♻️ Waste AI Classifier
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Upload an image to identify the waste type using Roboflow.
        </p>

        <div className="flex flex-col items-center space-y-6">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
          />

          {image && (
            <div className="relative w-full max-w-sm rounded-lg overflow-hidden shadow-lg border-2 border-green-200">
              <img
                src={typeof image === "string" ? image : ""}
                alt="Preview"
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          <button
            onClick={handleClassify}
            className={`w-full py-3 px-6 text-lg font-bold rounded-full shadow-lg transition duration-200 flex items-center justify-center space-x-2 ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
            disabled={loading || !image}
          >
            {loading && <Loader className="w-5 h-5 animate-spin" />}
            <span>{loading ? "Classifying..." : "Classify Waste"}</span>
          </button>
        </div>

        {result && (
          <div className="mt-10 pt-6 border-t border-gray-200">
            <h3 className="text-2xl font-bold mb-4 text-green-600">Classification Results</h3>
            <div className="space-y-3">{formatResults(result)}</div>

            <details className="mt-6 p-4 bg-gray-50 rounded-lg cursor-pointer">
              <summary className="font-semibold text-sm text-gray-600 hover:text-gray-900">
                Show Raw API Response
              </summary>
              <pre className="mt-2 text-xs text-left whitespace-pre-wrap wrap-break-word bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>

      <MessageBox
        type={message?.type || null}
        message={message?.text || null}
        onClose={() => setMessage(null)}
      />
    </div>
  );
};

export default Part2;

