import React from "react";
import { useProject } from "./contexts/useProject";
import { Card } from "./components/ui";
import { useAllGraphData } from "./hooks/useQueryHooks";
import { ChartGridSkeleton } from "./components/Skeletons";
import {
  WAFDetectionChart,
  SeveritySummaryChart,
  TechnologySummaryChart,
  PortDistributionBarChart,
  AnomalyChart,
  VulnerabilitiesBySeverityChart,
} from "./Graphs";
import { TrendingUp, ShieldCheck, Server, Bug, AlertTriangle, BarChart3 } from "lucide-react";

/* Reusable chart card wrapper */
const ChartCard = ({ icon: Icon, title, data, children }) => (
  <Card hover className="overflow-hidden">
    <div className="px-5 py-4 border-b border-gray-200 dark:border-white/[0.06] flex items-center gap-3">
      <div className="p-2 rounded-lg bg-gray-100 dark:bg-white/[0.04]">
        <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </div>
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h2>
    </div>
    <div className="p-5">
      {data ? (
        children
      ) : (
        <div className="flex flex-col items-center justify-center h-56 text-gray-400 dark:text-gray-500">
          <Icon className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-xs text-gray-400 dark:text-gray-500">No data available</p>
        </div>
      )}
    </div>
  </Card>
);

const GraphsPage = () => {
  const { project: selectedProject } = useProject();
  const { isLoading, severity, technology, waf, ports, anomalies, vulnerabilities } =
    useAllGraphData(selectedProject?.id);

  if (isLoading || !selectedProject) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-white/[0.04] animate-pulse" />
          <div className="h-5 w-40 rounded bg-gray-200 dark:bg-white/[0.04] animate-pulse" />
        </div>
        <ChartGridSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06]">
            <TrendingUp className="h-5 w-5 text-primary-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Security Analytics
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 ml-12">
          Comprehensive visualization of your security assessment data
        </p>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <ChartCard icon={AlertTriangle} title="Anomaly Detection" data={anomalies}>
          <AnomalyChart anomalyData={anomalies} />
        </ChartCard>

        <ChartCard icon={Bug} title="Severity Distribution" data={severity}>
          <SeveritySummaryChart vulnerabilityData={vulnerabilities} />
        </ChartCard>

        <ChartCard icon={Server} title="Technology Stack" data={technology}>
          <TechnologySummaryChart data={technology} />
        </ChartCard>

        <ChartCard icon={ShieldCheck} title="WAF Detection" data={waf}>
          <WAFDetectionChart wafStats={waf} />
        </ChartCard>

        <ChartCard icon={BarChart3} title="Vulnerability Breakdown" data={vulnerabilities}>
          <VulnerabilitiesBySeverityChart severityData={severity} />
        </ChartCard>

        <ChartCard icon={TrendingUp} title="Port Distribution" data={ports}>
          <PortDistributionBarChart portCounts={ports} />
        </ChartCard>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Data visualizations update in real-time as scans complete
        </p>
      </div>
    </div>
  );
};

export default GraphsPage;
