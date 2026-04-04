from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import create_access_token, get_password_hash, verify_password


class AuthService:
    def __init__(
        self,
        database: AsyncIOMotorDatabase,
        *,
        cookie_secure: bool,
        cookie_samesite: str,
    ):
        self.database = database
        self.users = database["users"]
        self.cookie_secure = cookie_secure
        self.cookie_samesite = cookie_samesite

    async def check_account_exists(self) -> bool:
        return await self.users.count_documents({}) > 0

    async def register(self, *, username: str, password: str) -> str:
        if await self.check_account_exists():
            raise HTTPException(
                status_code=403,
                detail="User registration is disabled after the first account is created",
            )

        normalized_username = username.strip()
        if not normalized_username:
            raise HTTPException(status_code=400, detail="Username is required")

        existing_user = await self.users.find_one({"username": normalized_username})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")

        user_doc = {
            "username": normalized_username,
            "hashed_password": get_password_hash(password),
            "created_at": datetime.now(timezone.utc),
        }
        result = await self.users.insert_one(user_doc)
        if not result.inserted_id:
            raise HTTPException(status_code=400, detail="Failed to create user")
        return str(result.inserted_id)

    async def login(self, *, username: str, password: str, response: Response) -> None:
        normalized_username = username.strip()
        user = await self.users.find_one({"username": normalized_username})
        if not user or not verify_password(password, user["hashed_password"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        access_token = create_access_token({"sub": str(user["_id"])})
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=self.cookie_secure,
            samesite=self.cookie_samesite,
            max_age=3600,
            path="/",
        )

    def logout(self, response: Response) -> None:
        response.delete_cookie(
            key="access_token",
            path="/",
            httponly=True,
            secure=self.cookie_secure,
            samesite=self.cookie_samesite,
        )

    async def change_password(
        self,
        *,
        user_id: str,
        current_password: str,
        new_password: str,
    ) -> None:
        try:
            user_object_id = ObjectId(user_id)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid user ID format") from exc

        user = await self.users.find_one({"_id": user_object_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not verify_password(current_password, user["hashed_password"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        if current_password == new_password:
            raise HTTPException(
                status_code=400,
                detail="New password must be different from the current password",
            )

        await self.users.update_one(
            {"_id": user_object_id},
            {
                "$set": {
                    "hashed_password": get_password_hash(new_password),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
