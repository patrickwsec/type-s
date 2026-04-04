from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8)


class AccountExistsResponse(BaseModel):
    exists: bool


class AuthStatusResponse(BaseModel):
    authenticated: bool


class LoginResponse(BaseModel):
    message: str


class LogoutResponse(BaseModel):
    message: str


class RegisterResponse(BaseModel):
    success: bool
    user_id: str


class PasswordChangeResponse(BaseModel):
    message: str
