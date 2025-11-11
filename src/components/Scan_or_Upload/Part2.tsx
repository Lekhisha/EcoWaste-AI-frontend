import { useState, useEffect, useRef } from "react";
import { Upload, Loader2, Trash2, Image as ImageIcon } from "lucide-react"; 

// 🎯 YOUR DEPLOYED BACKEND URL
const BACKEND_URL = "https://eco-waste-ai-backend-gux8i1zhf-lekhisha-reddys-projects.vercel.app/api/classify";

// --- 1. Waste Category Types ---
type WasteCategoryKey =
  | "PlasticFilm"
  | "Metal"
  | "RigidPlastic"
  | "Paper"
  | "Glass"
  | "Cardboard"
  | "FoodOrganics";

interface WasteDetail {
  type: string;
  recyclable?: boolean;
  compostable?: boolean;
  special?: boolean;
  note: string;
}

interface ClassificationResult {
  label: string;
  category: string;
  imageUrl: string | null; 
}

// --- 2. Waste Classification Map and Scoring Configuration ---
const KEYWORD_SCORES: Record<WasteCategoryKey, string[]> = {
  PlasticFilm: [
    "plastic bag", "film", "wrapping", "wrap", "grocery bag", "carrier bag",
    "plastic sheet", "polyethylene", "shopping bag", "clear plastic",
  ],
  Metal: [
    "metal", "steel", "aluminum", "aluminium", "tin", "can", "foil", 
    "beverage can", "utensil", "cutlery", "silverware", "cookware",
  ],
  RigidPlastic: [
    "bottle", "container", "jug", "rigid plastic", "tub", "pet bottle", "plastic bottle",
  ],
  Paper: [
    "paper", "book", "magazine", "newspaper", "flyer", "printed paper", "notebook",
  ],
  Glass: [
    "glass", "jar", "shattered", "cup", "tumbler", "cut glass", "bottle", "window",
  ],
  Cardboard: [
    "box", "cardboard", "carton", "packaging", "paperboard", "corrugated",
  ],
  FoodOrganics: [
    "banana", "apple", "orange", "pizza slice", "leaf", "log", "food", 
    "fruit", "vegetable", "compost", "peel",
  ],
};

const WASTE_MAP: Record<string, WasteDetail> = {
  rigid_plastic_default: {
    type: "Plastic (Rigid)", recyclable: true,
    note: "Empty, rinse, and replace the cap. This is rigid plastic.",
  },
  metal_default: {
    type: "Metal", recyclable: true,
    note: "Rinse well and flatten if possible.",
  },
  glass_default: {
    type: "Glass", recyclable: true,
    note: "Empty and rinse well. Intact glass containers are recyclable.",
  },
  cardboard_default: {
    type: "Cardboard", recyclable: true,
    note: "Must be flattened and dry. Remove all tape.",
  },
  paper_default: {
    type: "Paper", recyclable: true,
    note: "Recyclable. Books, newspapers, and office paper should be clean and dry.",
  },
  plastic_film_trash: {
    type: "Miscellaneous Trash", recyclable: false,
    note: "Plastic film/bags are NOT curbside recyclable. Use store drop-off or trash.",
  },
  broken_glass_special: {
    type: "Glass (Broken)", recyclable: false, special: true,
    note: "Broken glass is NOT recyclable. Wrap safely and discard.",
  },
  organic_compost: {
    type: "Food Organics", recyclable: false, compostable: true,
    note: "Compostable/Green Bin waste.",
  },
  UNKNOWN_FALLBACK: {
    type: "Miscellaneous Trash", recyclable: false,
    note: "Item not recognized. Defaulting to Miscellaneous Trash.",
  },
};

// --- 3. Main Component ---
const Part2 = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [classification, setClassification] =
    useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string>("");
  const [history, setHistory] = useState<ClassificationResult[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load and save history
  useEffect(() => {
    const saved = localStorage.getItem("wasteHistory");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("wasteHistory", JSON.stringify(history));
  }, [history]);

  // Unified file handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setClassification(null);
    setError("");

    const reader = new FileReader();
    reader.onloadend = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };
  
  // Handler to trigger the hidden file input
  const triggerFileUpload = () => fileInputRef.current?.click();

  // Helper functions for UI styling
  const getCategoryColor = (category: string) => {
    switch (category) {
        case "Recyclable": return "bg-green-100 text-green-700";
        case "Compostable": return "bg-lime-100 text-lime-700";
        default: return "bg-gray-200 text-gray-700";
    }
  }
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
        case "Recyclable": return "♻️";
        case "Compostable": return "🌱";
        default: return "🗑️";
    }
  }


  // --- Classification Logic (FIXED FOR DEPLOYED URL) ---
  const handleClassify = async () => {
    if (!imageUrl) return alert("Please upload an image first!");
    setLoading(true);
    setError("");
    setClassification(null);

    const currentImageUrl = imageUrl; 

    // Extract all keywords from the map into a single flat array for Zero-Shot Classification
    const candidateLabels = Object.values(KEYWORD_SCORES).flat();

    try {
      // 🌟 FIX: Fetch using the DEPLOYED BACKEND URL
      const res = await fetch(BACKEND_URL, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            imageData: imageUrl, 
            candidateLabels: candidateLabels 
        }),
      });
      
      // Check for errors like 401 or 500 from the backend itself
      if (!res.ok) {
          const errorData = await res.json();
          throw new Error(`Server Error (${res.status}): ${errorData.error || 'Check server console.'}`);
      }

      const data = await res.json();
      
      // The CLIP Zero-Shot model returns an array of objects. We take the label 
      // with the highest score (which is the first element in the array).
      const topResult = data.results?.[0];
      // Note: CLIP Zero-Shot returns the *label* as a key in the returned object, 
      // which is usually the one with the highest score when sent in the body.
      // We assume the model returns the top label in the structure: { sequence: '...', labels: [top_label, ...], scores: [...] }
      const label = topResult?.labels?.[0]?.toLowerCase() || "unknown";


      // Match keywords (rest of your logic remains correct for keyword matching)
      let matchedCategory: WasteCategoryKey | null = null;
      for (const [category, keywords] of Object.entries(KEYWORD_SCORES)) {
        if (keywords.some((kw) => label.includes(kw))) {
          matchedCategory = category as WasteCategoryKey;
          break;
        }
      }
      
      let wasteDetail: WasteDetail = WASTE_MAP.UNKNOWN_FALLBACK;
      if (matchedCategory) {
        switch (matchedCategory) {
          case "Metal":
            wasteDetail = WASTE_MAP.metal_default;
            break;
          case "Glass":
            if (label.includes("shattered") || label.includes("broken")) {
                 wasteDetail = WASTE_MAP.broken_glass_special;
            } else {
                 wasteDetail = WASTE_MAP.glass_default;
            }
            break;
          case "Cardboard":
            wasteDetail = WASTE_MAP.cardboard_default;
            break;
          case "Paper":
            wasteDetail = WASTE_MAP.paper_default;
            break;
          case "RigidPlastic":
            wasteDetail = WASTE_MAP.rigid_plastic_default;
            break;
          case "PlasticFilm":
            wasteDetail = WASTE_MAP.plastic_film_trash;
            break;
          case "FoodOrganics":
            wasteDetail = WASTE_MAP.organic_compost;
            break;
          default:
            wasteDetail = WASTE_MAP.UNKNOWN_FALLBACK;
        }
      }

      if (!wasteDetail || !('type' in wasteDetail)) {
          wasteDetail = WASTE_MAP.UNKNOWN_FALLBACK;
      }

      const newItem: ClassificationResult = {
        label: wasteDetail.type,
        category: wasteDetail.compostable
          ? "Compostable"
          : wasteDetail.recyclable
          ? "Recyclable"
          : "Miscellaneous Trash",
        imageUrl: currentImageUrl, 
      };

      setClassification(newItem);
      setHistory([newItem, ...history].slice(0, 5)); 
    } catch (err: any) {
      console.error("Classification error:", err);
      setError(`Error classifying image: ${err.message || 'Check your network connection and backend server.'}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = (index: number) =>
    setHistory(history.filter((_, i) => i !== index));
  const clearHistory = () => setHistory([]);

  return (
    <div className="min-h-screen bg-linear-to-r from-amber-100 to-green-200 flex flex-col items-center py-10 px-4" >
      
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-extrabold text-green-800 text-center mb-8 tracking-tight">
          Waste classifier
        </h1>


        {/* --- Image Input and Control Card --- */}
        <div className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 mb-8">
          
          <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <ImageIcon size={24} className="text-blue-500" /> Image Input
          </h2>
          
          <div className="flex justify-center mb-6"> {/* Centered upload button */}
            
            {/* Upload Button */}
            <button
              onClick={triggerFileUpload}
              className="w-2/3 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 transition font-medium shadow-md"
            >
              <Upload size={20} /> Upload Image
            </button>
            
            {/* Hidden Input for File Upload */}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              hidden
              ref={fileInputRef}
            />
          </div>

          {imageUrl && (
            <div className="mb-6 flex justify-center">
              <img
                src={imageUrl}
                alt="Waste Preview"
                className="rounded-xl max-h-64 object-cover border-4 border-gray-200 shadow-lg"
              />
            </div>
          )}

          {/* Classification Button */}
          <button
            onClick={handleClassify}
            disabled={loading || !imageUrl}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-lg font-bold transition shadow-lg ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              "Classify Waste"
            )}
          </button>
        </div>

        {/* --- Result and Error Area --- */}
        {(classification || error) && (
          <div className="p-6 rounded-3xl shadow-2xl w-full bg-white border border-gray-100 mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">
              Classification Outcome
            </h2>
            
            {classification && (
                <div className="text-center p-4 rounded-xl border border-gray-200">
                    <p className="text-4xl mb-2">{getCategoryIcon(classification.category)}</p>
                    <p className="text-lg font-medium text-gray-600">
                        <strong>Item:</strong> {classification.label}
                    </p>
                    <div className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-bold ${getCategoryColor(classification.category)}`}>
                        {classification.category}
                    </div>
                </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-xl text-center font-medium border border-red-300">
                ⚠️ {error}
              </div>
            )}
          </div>
        )}

        {/* --- History Card (Horizontal Scroll) --- */}
        {history.length > 0 && (
          <div className="w-full bg-white p-6 rounded-3xl shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-semibold text-gray-700">
                Recent Scans ({history.length} of 5)
              </h3>
              <button
                onClick={clearHistory}
                className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1 transition"
              >
                <Trash2 size={16} /> Clear All
              </button>
            </div>

            {/* Horizontal Scrolling Container */}
            <div className="flex overflow-x-auto pb-4 space-x-4">
              {history.map((item, i) => (
                <div
                  key={i}
                  className="shrink-0 w-40 bg-gray-50 rounded-xl shadow-md border border-gray-200 relative overflow-hidden"
                >
                  <button
                    onClick={() => deleteItem(i)}
                    className="absolute top-2 right-2 text-white bg-red-500/80 hover:bg-red-600 rounded-full p-1 z-10 transition"
                    aria-label="Delete item"
                  >
                    <Trash2 size={14} />
                  </button>
                  
                  {/* Image Thumbnail */}
                  <div className="h-28 w-full bg-gray-300">
                      {item.imageUrl ? (
                          <img
                              src={item.imageUrl}
                              alt={item.label}
                              className="w-full h-full object-cover"
                          />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                              No Image
                          </div>
                      )}
                  </div>

                  {/* Classification Details */}
                  <div className="p-3 text-center">
                    <p className="font-semibold text-sm text-gray-800 truncate" title={item.label}>
                        {item.label}
                    </p>
                    <div className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getCategoryColor(item.category)}`}>
                        {getCategoryIcon(item.category)} {item.category}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Part2;
