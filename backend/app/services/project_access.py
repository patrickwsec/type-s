from bson import ObjectId
from fastapi import HTTPException


async def get_project_for_user(projects_collection, project_id: str, user_id: str) -> dict:
    try:
        project_object_id = ObjectId(project_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid project ID format") from exc

    project = await projects_collection.find_one({"_id": project_object_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")

    return project
