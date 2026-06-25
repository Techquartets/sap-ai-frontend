import apiClient from "./apiClient";

export const authService = {

  // LOGIN
  login: async (email, password) => {

    try {

      const response = await apiClient.post(
        "/sap/security/login/",
        {
          email,
          password,
        }
      );

      const data = response.data;

      // save token/user
      localStorage.setItem(

        "authToken",

        data.token || "authenticated"
      );

      localStorage.setItem(

        "user",

        JSON.stringify(data.user)
      );

      return {

        success: true,

        user: data.user,
      };

    } catch (error) {

      return {

        success: false,

        error:
          error.response?.data?.message ||
          "Invalid credentials",
      };
    }
  },

  // LOGOUT
  logout: async () => {

    localStorage.removeItem("authToken");

    localStorage.removeItem("user");

    return {
      success: true,
    };
  },

  // CURRENT USER
  getCurrentUser: async () => {

    const user = localStorage.getItem("user");

    if (!user) {

      return {

        success: false,

        data: null,
      };
    }

    return {

      success: true,

      data: JSON.parse(user),
    };
  },
};