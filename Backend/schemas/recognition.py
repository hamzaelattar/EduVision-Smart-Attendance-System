from typing import Literal

from pydantic import Field

from schemas.common import ApiModel


class FrameMessage(ApiModel):
    type: Literal["frame"]
    session_id: str = Field(min_length=1, max_length=36)
    sequence: int = Field(ge=0)
    image: str = Field(min_length=8, max_length=2_100_000)
