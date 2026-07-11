// import { useState, useEffect, useCallback } from "react";

// import Sidebar from "../components/layout/Sidebar";
// import Topbar from "../components/layout/Topbar";
// import RuleLibraryFull from "../components/rule-library/RuleLibraryFull";

// import { ruleService } from "../services/ruleService";
// import { sapService } from "../services/sapService";

// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// export default function RuleLibrary() {

//   const [sapStatus, setSapStatus] = useState(null);
//   const [apiError, setApiError] = useState(null);

//   const [isCreatingRule, setIsCreatingRule] = useState(false);

//   // ✅ REAL RULES FROM DJANGO
//   const [rules, setRules] = useState([]);

//   // ✅ loading state
//   const [loadingRules, setLoadingRules] = useState(true);

//   useEffect(() => {
//     checkBackendConnection();
//     loadRules();
//   }, []);

//   // ───────────────────────────────────────────────
//   // Load Rules
//   // ───────────────────────────────────────────────

//   const loadRules = async () => {
//     try {
//       setLoadingRules(true);

//       const res = await fetch(`${API_BASE_URL}/sap/rules/`);

//       if (!res.ok) {
//         throw new Error(`HTTP ${res.status}`);
//       }

//       const data = await res.json();

//       if (data.status !== "success") {
//         throw new Error(data.message || "Failed to load rules");
//       }

//       setRules(data.data || []);

//     } catch (error) {
//       console.error("Load Rules Error:", error);
//       setApiError(error.message);
//     } finally {
//       setLoadingRules(false);
//     }
//   };

//   // ───────────────────────────────────────────────
//   // SAP Connection
//   // ───────────────────────────────────────────────

//   const checkBackendConnection = async () => {
//     try {
//       const result = await sapService.testConnection();

//       setSapStatus(result);

//       if (result.status === "error") {
//         setApiError("SAP connection failed: " + result.message);
//       }

//     } catch (error) {

//       setApiError("Failed to connect to backend: " + error.message);

//       console.error("Backend connection error:", error);
//     }
//   };

//   // ───────────────────────────────────────────────
//   // AI Rule Request
//   // ───────────────────────────────────────────────

//   const processRuleRequest = useCallback(async (userInput) => {

//     setIsCreatingRule(true);
//     setApiError(null);

//     try {

//       const result = await ruleService.processRuleRequest(userInput);

//       if (result.status === "error") {
//         setApiError(result.message);
//         return null;
//       }

//       // ✅ Refresh rules after creation
//       await loadRules();

//       return result;

//     } catch (error) {

//       setApiError(error.message);

//       return null;

//     } finally {

//       setIsCreatingRule(false);
//     }

//   }, []);

//   return (
//     <div className="flex h-screen overflow-hidden bg-[var(--bg)]">

//       <Sidebar />

//       <div className="flex-1 flex flex-col overflow-hidden">

//         <Topbar />

//         <div className="flex-1 overflow-y-auto">

//           {/* Error */}
//           {apiError && (
//             <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-[12px]">
//               ⚠️ {apiError}
//             </div>
//           )}

//           {/* SAP Connected */}
//           {sapStatus && sapStatus.status === "connected" && (
//             <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[12px]">
//               ✓ SAP Connected and ready for rule deployment
//             </div>
//           )}

//           {/* Page title */}
//           <div className="px-6 pt-5 pb-0">
//             <h1 className="text-xl font-semibold text-[var(--text)]">
//               Rule Library
//             </h1>
//           </div>

//           {/* Loading */}
//           {loadingRules ? (
//             <div className="p-6 text-sm text-gray-400">
//               Loading rules...
//             </div>
//           ) : (

//             <RuleLibraryFull

//               // ✅ API RULES
//               rules={rules}

//               // refresh support
//               refreshRules={loadRules}

//               // existing props
//               onProcessRule={processRuleRequest}
//               isProcessingRule={isCreatingRule}
//               sapStatus={sapStatus}
//             />
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }



import { useState, useEffect, useCallback } from "react";

import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import RuleLibraryFull from "../components/rule-library/RuleLibraryFull";

import { ruleService } from "../services/ruleService";
import { sapService } from "../services/sapService";

export default function RuleLibrary() {

  const [sapStatus, setSapStatus] = useState(null);
  const [apiError, setApiError] = useState(null);

  const [isCreatingRule, setIsCreatingRule] = useState(false);

  // ───────────────────────────────────────────────
  // Initial Load
  // ───────────────────────────────────────────────

  useEffect(() => {
    checkBackendConnection();
  }, []);

  // ───────────────────────────────────────────────
  // SAP Connection
  // ───────────────────────────────────────────────

  const checkBackendConnection = async () => {
    try {

      const result = await sapService.testConnection();

      setSapStatus(result);

      if (result.status === "error") {
        setApiError("SAP connection failed: " + result.message);
      }

    } catch (error) {

      setApiError("Failed to connect to backend: " + error.message);

      console.error("Backend connection error:", error);
    }
  };

  // ───────────────────────────────────────────────
  // AI Rule Request
  // ───────────────────────────────────────────────

  const processRuleRequest = useCallback(async (userInput) => {

    setIsCreatingRule(true);
    setApiError(null);

    try {

      const result = await ruleService.processRuleRequest(userInput);

      if (result.status === "error") {
        setApiError(result.message);
        return null;
      }

      return result;

    } catch (error) {

      setApiError(error.message);

      return null;

    } finally {

      setIsCreatingRule(false);
    }

  }, []);

  return (

    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">

        <Topbar />

        <div className="flex-1 overflow-y-auto">

          {/* Error */}
          {apiError && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-[12px]">
              ⚠️ {apiError}
            </div>
          )}

          {/* SAP Connected */}
          {sapStatus && sapStatus.status === "connected" && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[12px]">
              ✓ SAP Connected and ready for rule deployment
            </div>
          )}

          {/* Page title */}
          <div className="px-6 pt-5 pb-0">
            <h1 className="text-xl font-semibold text-[var(--text)]">
              Rule Library
            </h1>
          </div>

          {/* Rule Library */}
          <RuleLibraryFull
            onProcessRule={processRuleRequest}
            isProcessingRule={isCreatingRule}
            sapStatus={sapStatus}
          />

        </div>
      </div>
    </div>
  );
}