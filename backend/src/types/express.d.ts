import type {
    AuthenticatedUser
} from "./auth.types.ts";

declare global {
    namespace Express {
        interface Request {
            //Usuario obtenido a partir del JWT
            user?: AuthenticatedUser;
        }
    }
}

export {};