from collections import Counter

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.project_access import get_project_for_user


class AnalyticsService:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.database = database
        self.projects = database["projects"]
        self.assets = database["v2_assets"]
        self.findings = database["v2_findings"]

    async def get_graph_data(
        self,
        *,
        project_id: str,
        owner_id: str,
        graph_type: str,
    ):
        await get_project_for_user(self.projects, project_id, owner_id)

        if graph_type == "severity_summary":
            return await self._severity_summary(project_id, owner_id)
        if graph_type == "vulnerability_distribution":
            return await self._vulnerability_distribution(project_id, owner_id)
        if graph_type == "ports_summary":
            return await self._ports_summary(project_id, owner_id)
        if graph_type == "anomalies":
            return await self._anomalies(project_id, owner_id)
        if graph_type == "waf_detection":
            return await self._waf_detection(project_id, owner_id)
        if graph_type == "technology_summary":
            return await self._technology_summary(project_id, owner_id)

        raise ValueError("Invalid graph type specified.")

    async def _severity_summary(self, project_id: str, owner_id: str):
        cursor = self.findings.aggregate(
            [
                {"$match": {"project_id": project_id, "owner_id": owner_id}},
                {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
                {"$project": {"severity": "$_id", "count": 1, "_id": 0}},
                {"$sort": {"count": -1}},
            ]
        )
        return await cursor.to_list(length=None)

    async def _vulnerability_distribution(self, project_id: str, owner_id: str):
        cursor = self.findings.aggregate(
            [
                {"$match": {"project_id": project_id, "owner_id": owner_id}},
                {"$group": {"_id": "$title", "count": {"$sum": 1}}},
                {"$project": {"name": "$_id", "count": 1, "_id": 0}},
                {"$sort": {"count": -1, "name": 1}},
            ]
        )
        return await cursor.to_list(length=None)

    async def _ports_summary(self, project_id: str, owner_id: str):
        cursor = self.assets.aggregate(
            [
                {"$match": {"project_id": project_id, "owner_id": owner_id}},
                {"$unwind": "$ports"},
                {"$group": {"_id": "$ports", "count": {"$sum": 1}}},
                {"$project": {"port": "$_id", "count": 1, "_id": 0}},
                {"$sort": {"port": 1}},
            ]
        )
        return await cursor.to_list(length=None)

    async def _technology_summary(self, project_id: str, owner_id: str):
        cursor = self.assets.aggregate(
            [
                {"$match": {"project_id": project_id, "owner_id": owner_id}},
                {"$unwind": "$technologies"},
                {"$group": {"_id": "$technologies", "count": {"$sum": 1}}},
                {"$project": {"technology": "$_id", "count": 1, "_id": 0}},
                {"$sort": {"count": -1, "technology": 1}},
            ]
        )
        return await cursor.to_list(length=None)

    async def _anomalies(self, project_id: str, owner_id: str):
        assets = await self.assets.find(
            {"project_id": project_id, "owner_id": owner_id}
        ).to_list(length=None)
        findings = await self.findings.find(
            {"project_id": project_id, "owner_id": owner_id}
        ).to_list(length=None)

        port_counts: Counter[int] = Counter()
        tech_counts: Counter[str] = Counter()
        finding_counts: Counter[str] = Counter()

        for asset in assets:
            port_counts.update(asset.get("ports", []))
            tech_counts.update(asset.get("technologies", []))

        for finding in findings:
            title = finding.get("title") or "Unknown Vulnerability"
            finding_counts.update([title])

        rare_ports = {
            f"Port: {port}": count
            for port, count in port_counts.items()
            if count < len(assets) * 0.05
        }
        rare_technologies = {
            technology: count
            for technology, count in tech_counts.items()
            if count < 5
        }
        rare_findings = {
            title: count
            for title, count in finding_counts.items()
            if count < 5
        }

        return {**rare_ports, **rare_findings, **rare_technologies}

    async def _waf_detection(self, project_id: str, owner_id: str):
        live_assets = await self.assets.find(
            {
                "project_id": project_id,
                "owner_id": owner_id,
                "status_code": {"$gt": 0},
            },
            {"_id": 1},
        ).to_list(length=None)
        live_asset_ids = [asset["_id"] for asset in live_assets]
        if not live_asset_ids:
            return {
                "wafCounts": {},
                "totalWithWAF": 0,
                "totalWithoutWAF": 0,
            }

        cursor = self.findings.aggregate(
            [
                {
                    "$match": {
                        "project_id": project_id,
                        "owner_id": owner_id,
                        "asset_id": {"$in": live_asset_ids},
                        "title": "WAF Detection",
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "asset_id": "$asset_id",
                            "matcher_name": {"$ifNull": ["$matcher_name", "Unknown WAF"]},
                        }
                    }
                },
                {
                    "$group": {
                        "_id": "$_id.matcher_name",
                        "count": {"$sum": 1},
                    }
                },
            ]
        )
        grouped = await cursor.to_list(length=None)
        waf_counts = {item["_id"]: item["count"] for item in grouped}

        matched_assets = await self.findings.distinct(
            "asset_id",
            {
                "project_id": project_id,
                "owner_id": owner_id,
                "asset_id": {"$in": live_asset_ids},
                "title": "WAF Detection",
            },
        )
        total_with_waf = len(matched_assets)
        return {
            "wafCounts": waf_counts,
            "totalWithWAF": total_with_waf,
            "totalWithoutWAF": len(live_asset_ids) - total_with_waf,
        }
