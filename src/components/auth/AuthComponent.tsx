import { useEffect, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { AuthError, AuthApiError } from "@supabase/supabase-js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export const getErrorMessage = (error: AuthError) => {
  if (error instanceof AuthApiError) {
    switch (error.message) {
      case "Invalid login credentials":
        return "Invalid email or password. Please check your credentials and try again.";
      case "Email not confirmed":
        return "Please verify your email address before signing in.";
      default:
        return error.message;
    }
  }
  return error.message;
};

export const AuthComponent = () => {
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        setAuthError("");
      } else if (event === "SIGNED_OUT") {
        setAuthError("");
      } else if (event === "USER_UPDATED") {
        const checkSession = async () => {
          const { error } = await supabase.auth.getSession();
          if (error) setAuthError(getErrorMessage(error));
        };
        checkSession();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">
        PPTX Content Extractor
      </h1>
      {authError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{authError}</AlertDescription>
        </Alert>
      )}
      <Auth
        supabaseClient={supabase}
        appearance={{ 
          theme: ThemeSupa,
          style: {
            button: { background: 'rgb(59 130 246)', color: 'white' },
            anchor: { color: 'rgb(59 130 246)' },
          }
        }}
        theme="light"
        providers={[]}
        redirectTo={window.location.origin}
      />
    </div>
  );
};