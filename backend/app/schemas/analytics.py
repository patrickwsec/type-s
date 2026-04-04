from typing import Any

from pydantic import BaseModel


class GraphDataResponse(BaseModel):
    success: bool = True
    graph_type: str
    data: Any
