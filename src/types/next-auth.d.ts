import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    isDemo: boolean;
  }

  interface Session {
    user: {
      id: string;
      isDemo: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isDemo: boolean;
  }
}
