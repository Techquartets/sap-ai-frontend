import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import dashboardReducer from "../features/dashboard/dashboardSlice";
import rulesReducer from "../features/rules/rulesSlice";
import securityReducer from "../features/security/securitySlice";
import notificationsReducer from "../features/notifications/notificationsSlice";
import AIRuleArchitect from "../pages/AIRuleArchitect";
import serversReducer from "../features/servers/serversSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    rules: rulesReducer,
    security: securityReducer,
    notifications: notificationsReducer,
    servers: serversReducer,
    // AIRuleArchitect:AIRuleArchitect,
  },
});

