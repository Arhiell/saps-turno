// Errores personalizados para la aplicación

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string | undefined;
  public readonly data: Record<string, unknown> | undefined;

  constructor(
    message: string,
    statusCode = 500,
    code?: string,
    data?: Record<string, unknown>
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.data = data;
  }
}