from fastapi import APIRouter, Depends, Response

from app.api.dependencies import get_auth_service
from app.core.security import get_current_user
from app.schemas.auth import (
    AccountExistsResponse,
    AuthStatusResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    PasswordChangeRequest,
    PasswordChangeResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.services.auth import AuthService


router = APIRouter()


@router.get("/check-account", response_model=AccountExistsResponse)
async def check_account(
    auth_service: AuthService = Depends(get_auth_service),
):
    return AccountExistsResponse(exists=await auth_service.check_account_exists())


@router.get("/check-auth", response_model=AuthStatusResponse)
async def check_auth(user_id: str = Depends(get_current_user)):
    return AuthStatusResponse(authenticated=bool(user_id))


@router.post("/register", response_model=RegisterResponse)
async def register(
    request: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    user_id = await auth_service.register(
        username=request.username,
        password=request.password,
    )
    return RegisterResponse(success=True, user_id=user_id)


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    await auth_service.login(
        username=request.username,
        password=request.password,
        response=response,
    )
    return LoginResponse(message="Login successful")


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    auth_service.logout(response)
    return LogoutResponse(message="Logout successful")


@router.post("/change-password", response_model=PasswordChangeResponse)
async def change_password(
    request: PasswordChangeRequest,
    user_id: str = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
):
    await auth_service.change_password(
        user_id=user_id,
        current_password=request.current_password,
        new_password=request.new_password,
    )
    return PasswordChangeResponse(message="Password changed successfully")
