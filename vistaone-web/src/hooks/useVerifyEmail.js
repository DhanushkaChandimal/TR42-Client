import { authService } from "../services/authServices";

const useVerifyEmail = () => {
  const verifyEmail = async (token) => {
    return await authService.verifyEmail(token);
  };
  return { verifyEmail };
};

export default useVerifyEmail;
