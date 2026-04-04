import React, { useState } from "react";
import ReactApexChart from "react-apexcharts";


// Severity Summary Chart - Modern Horizontal Bar Chart
export const SeveritySummaryChart = ({ vulnerabilityData }) => {
  const [showAll, setShowAll] = useState(false);
  
  if (!vulnerabilityData || !Array.isArray(vulnerabilityData)) {
    return (
      <div className="text-gray-400 dark:text-gray-500 text-center py-8 text-xs">
        No data available for severity summary
      </div>
    );
  }

  // Show top 15 by default, or all if showAll is true
  const displayLimit = showAll ? vulnerabilityData.length : 15;
  const displayData = vulnerabilityData.slice(0, displayLimit);
  const hasMore = vulnerabilityData.length > displayLimit;

  const vulnerabilityNames = displayData.map((vuln) => vuln.name);
  const counts = displayData.map((vuln) => vuln.count);

  // Dynamic height based on number of items (30px per bar minimum)
  const chartHeight = Math.max(400, displayData.length * 30);

  const options = {
    chart: {
      type: "bar",
      height: chartHeight,
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'Inter, sans-serif',
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 2,
        dataLabels: { position: 'right' },
        distributed: false,
        barHeight: '70%', // Add spacing between bars
      },
    },
    fill: {
      type: "solid",
      opacity: 0.9,
    },
    dataLabels: {
      enabled: true,
      offsetX: -5,
      style: {
        fontSize: '10px',
        colors: ['#111827'],
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'bold',
      }
    },
    xaxis: {
      categories: vulnerabilityNames,
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '10px',
          fontFamily: 'Inter, sans-serif',
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: '#9ca3af',
          fontSize: '10px',
          fontFamily: 'Inter, sans-serif',
        },
        maxWidth: 250,
        trim: true,
      },
    },
    grid: {
      borderColor: '#374151',
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    tooltip: {
      theme: "dark",
      style: { fontSize: '11px', fontFamily: 'Inter, sans-serif' },
      y: {
        formatter: (val) => `${val} vulnerabilities`
      }
    },
    colors: ['#6b7280'],
  };

  const series = [{
    name: "Count",
    data: counts,
  }];

  return (
    <div className="w-full">
      <div className="max-h-[500px] overflow-y-auto">
        <ReactApexChart options={options} series={series} type="bar" height={chartHeight} />
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full py-2 px-4 bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.08] text-gray-600 dark:text-gray-300 text-xs rounded-lg border border-gray-200 dark:border-white/[0.06] transition-colors"
        >
          {showAll ? `Show less (top 15)` : `Show all ${vulnerabilityData.length} vulnerabilities`}
        </button>
      )}
    </div>
  );
};

      
// Modern Port Distribution Table
export const PortDistributionBarChart = ({ portCounts, setSearchTerm }) => {
  const transformedPorts = portCounts.reduce((acc, { port, count }) => {
    acc[port] = count;
    return acc;
  }, {});

  const sortedPorts = Object.entries(transformedPorts)
    .sort(([portA], [portB]) => parseInt(portA) - parseInt(portB))
    .slice(0, 20); // Show top 20 ports

  const handlePortClick = (port) => {
    if (typeof setSearchTerm === "function") {
      setSearchTerm(`port=${port}`);
    }
  };

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/[0.06]">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/[0.06]">
            <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.06] sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Port
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Occurrences
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900/60 divide-y divide-gray-100 dark:divide-white/[0.04]">
              {sortedPorts.map(([port, count], index) => {
                const total = sortedPorts.reduce((sum, [, c]) => sum + c, 0);
                const percentage = ((count / total) * 100).toFixed(1);
                
                return (
                  <tr
                    key={port}
                    className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    onClick={() => handlePortClick(port)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{port}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{count}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <div className="w-20 bg-gray-200 dark:bg-white/[0.06] rounded-full h-2">
                          <div 
                            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium min-w-[3rem]">
                          {percentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {sortedPorts.length === 0 && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-xs">
          No port data available
        </div>
      )}
    </div>
  );
};



// Modern WAF Detection Donut Chart
export const WAFDetectionChart = ({ wafStats }) => {
  if (!wafStats || !wafStats.wafCounts) {
    return (
      <div className="text-gray-400 dark:text-gray-500 text-center py-8 text-xs">
        No data available for WAF detection
      </div>
    );
  }

  const totalWithWAF = Number(wafStats.totalWithWAF);
  const totalWithoutWAF = Number(wafStats.totalWithoutWAF);
  const total = totalWithWAF + totalWithoutWAF;

  if (total === 0) {
    return (
      <div className="text-gray-400 dark:text-gray-500 text-center py-8 text-xs">
        No data available for WAF detection
      </div>
    );
  }

  const series = [totalWithWAF, totalWithoutWAF];

  const options = {
    chart: {
      type: "donut",
      height: 350,
      background: 'transparent',
      fontFamily: 'Inter, sans-serif',
    },
    labels: ["Protected by WAF", "No WAF Detected"],
    colors: ["#059669", "#dc2626"],
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '12px',
              color: '#9ca3af',
              fontFamily: 'Inter, sans-serif',
              offsetY: -10
            },
            value: {
              show: true,
              fontSize: '20px',
              fontWeight: 700,
              color: '#e5e7eb',
              fontFamily: 'Inter, sans-serif',
              offsetY: 5,
              formatter: (val) => val
            },
            total: {
              show: true,
              label: 'TOTAL ASSETS',
              fontSize: '11px',
              color: '#9ca3af',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 'bold',
              formatter: () => total
            }
          }
        }
      }
    },
    legend: {
      position: 'bottom',
      fontSize: '11px',
      fontFamily: 'Inter, sans-serif',
      labels: {
        colors: '#9ca3af',
      },
      markers: {
        width: 10,
        height: 10,
        radius: 2,
      },
      itemMargin: {
        horizontal: 10,
        vertical: 5,
      }
    },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: '12px',
        fontWeight: 700,
        fontFamily: 'Inter, sans-serif',
      },
      dropShadow: {
        enabled: false
      },
      formatter: (val, opts) => {
        return `${val.toFixed(1)}%`
      }
    },
    tooltip: {
      theme: "dark",
      style: {
        fontFamily: 'Inter, sans-serif',
      },
      y: {
        formatter: (value, { seriesIndex }) => {
          const percentage = ((value / total) * 100).toFixed(1);
          if (seriesIndex === 0 && Object.keys(wafStats.wafCounts).length > 0) {
            const wafDetails = Object.entries(wafStats.wafCounts)
              .map(([matcher, count]) => `${matcher}: ${count}`)
              .join(", ");
            return `${value} (${percentage}%) - ${wafDetails}`;
          }
          return `${value} (${percentage}%)`;
        }
      }
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['#111827']
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: { height: 300 },
        legend: { position: 'bottom' }
      }
    }]
  };

  return (
    <div className="w-full">
      <ReactApexChart options={options} series={series} type="donut" height={350} />
    </div>
  );
};


// Modern Technology Stack Chart
export const TechnologySummaryChart = ({ data }) => {
  const [showAll, setShowAll] = useState(false);
  
  if (!data || !Array.isArray(data)) {
    return (
      <div className="text-gray-400 dark:text-gray-500 text-center py-8 text-xs">
        No data available for technologies
      </div>
    );
  }

  // Sort by count and limit display
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const displayLimit = showAll ? sortedData.length : 20;
  const topTechnologies = sortedData.slice(0, displayLimit);
  const hasMore = sortedData.length > displayLimit;

  const techNames = topTechnologies.map((tech) => tech.technology);
  const counts = topTechnologies.map((tech) => tech.count);

  // Dynamic height based on number of items (25px per bar minimum)
  const chartHeight = Math.max(450, topTechnologies.length * 25);

  const options = {
    chart: {
      type: "bar",
      height: chartHeight,
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'Inter, sans-serif',
    },
    plotOptions: {
      bar: {
        borderRadius: 2,
        horizontal: true,
        distributed: true,
        barHeight: '65%',
        dataLabels: {
          position: 'right',
        },
      },
    },
    fill: {
      type: "solid",
      opacity: 0.85,
    },
    dataLabels: {
      enabled: true,
      offsetX: -5,
      style: {
        fontSize: '9px',
        colors: ['#111827'],
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'bold',
      }
    },
    xaxis: {
      categories: techNames,
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '9px',
          fontFamily: 'Inter, sans-serif',
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: '#9ca3af',
          fontSize: '9px',
          fontFamily: 'Inter, sans-serif',
        },
        maxWidth: 200,
        trim: true,
      },
    },
    grid: {
      borderColor: '#374151',
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    tooltip: {
      theme: "dark",
      style: {
        fontFamily: 'Inter, sans-serif',
      },
      y: {
        formatter: (val) => `${val} occurrences`
      }
    },
    colors: ['#6b7280', '#78716c', '#737373', '#71717a', '#64748b', '#6b7280', '#78716c', '#737373', '#71717a', '#64748b', '#6b7280', '#78716c', '#737373', '#71717a', '#64748b'],
    legend: {
      show: false
    }
  };

  const series = [{
    name: "Count",
    data: counts,
  }];

  return (
    <div className="w-full">
      <div className="max-h-[550px] overflow-y-auto">
        <ReactApexChart options={options} series={series} type="bar" height={chartHeight} />
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full py-2 px-4 bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.08] text-gray-600 dark:text-gray-300 text-xs rounded-lg border border-gray-200 dark:border-white/[0.06] transition-colors"
        >
          {showAll ? `Show less (top 20)` : `Show all ${sortedData.length} technologies`}
        </button>
      )}
    </div>
  );
};


// Modern Anomaly Detection Chart
export const AnomalyChart = ({ anomalyData }) => {
  const [showAll, setShowAll] = useState(false);
  
  if (!anomalyData || Object.keys(anomalyData).length === 0) {
    return (
      <div className="text-gray-400 dark:text-gray-500 text-center py-8 text-xs">
        No anomaly data available
      </div>
    );
  }

  // Sort anomalies by value (count) descending and limit
  const sortedAnomalies = Object.entries(anomalyData)
    .sort(([, a], [, b]) => b - a);
  
  const displayLimit = showAll ? sortedAnomalies.length : 20;
  const displayAnomalies = sortedAnomalies.slice(0, displayLimit);
  const hasMore = sortedAnomalies.length > displayLimit;

  const anomalies = displayAnomalies.map(([name]) => name);
  const anomalyValues = displayAnomalies.map(([, value]) => value);

  // Dynamic height based on number of items (28px per bar minimum)
  const chartHeight = Math.max(400, displayAnomalies.length * 28);

  const options = {
    chart: {
      type: "bar",
      height: chartHeight,
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'Inter, sans-serif',
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 2,
        barHeight: '68%',
        dataLabels: {
          position: 'right',
        },
      },
    },
    fill: {
      type: "solid",
      opacity: 0.9,
    },
    dataLabels: {
      enabled: true,
      offsetX: -5,
      style: {
        fontSize: '10px',
        colors: ['#111827'],
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'bold',
      }
    },
    xaxis: {
      categories: anomalies.map(name => name.length > 35 ? name.substring(0, 35) + '...' : name),
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '9px',
          fontFamily: 'Inter, sans-serif',
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: '#9ca3af',
          fontSize: '9px',
          fontFamily: 'Inter, sans-serif',
        },
        maxWidth: 220,
        trim: true,
      },
    },
    grid: {
      borderColor: '#374151',
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    tooltip: {
      theme: "dark",
      style: {
        fontFamily: 'Inter, sans-serif',
      },
      y: {
        formatter: (val, { dataPointIndex }) => {
          const fullName = anomalies[dataPointIndex];
          return `${fullName}: ${val} occurrences`;
        }
      }
    },
    colors: ['#dc2626'],
  };

  const series = [{
    name: "Anomaly Count",
    data: anomalyValues,
  }];

  return (
    <div className="w-full">
      <div className="max-h-[550px] overflow-y-auto">
        <ReactApexChart options={options} series={series} type="bar" height={chartHeight} />
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full py-2 px-4 bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.08] text-gray-600 dark:text-gray-300 text-xs rounded-lg border border-gray-200 dark:border-white/[0.06] transition-colors"
        >
          {showAll ? `Show less (top 20)` : `Show all ${sortedAnomalies.length} anomalies`}
        </button>
      )}
    </div>
  );
};






// Modern Vulnerabilities by Severity Chart
export const VulnerabilitiesBySeverityChart = ({ severityData }) => {
  if (!severityData || !Array.isArray(severityData)) {
    return (
      <div className="text-gray-400 dark:text-gray-500 text-center py-8 text-xs">
        No data available for vulnerabilities by severity
      </div>
    );
  }

  const severityColorMapping = {
    info: "#64748b",
    low: "#3b82f6",
    medium: "#f59e0b",
    high: "#f97316",
    critical: "#dc2626",
    unknown: "#6b7280",
  };

  const severityLabels = severityData.map((item) => 
    item.severity.charAt(0).toUpperCase() + item.severity.slice(1)
  );
  const severityValues = severityData.map((item) => item.count);
  const colors = severityData.map(
    (item) => severityColorMapping[item.severity.toLowerCase()] || "#6b7280"
  );

  const options = {
    chart: {
      type: "polarArea",
      height: 380,
      background: 'transparent',
      fontFamily: 'Inter, sans-serif',
    },
    labels: severityLabels,
    fill: {
      opacity: 0.85,
    },
    stroke: {
      width: 2,
      colors: ['#111827']
    },
    yaxis: {
      show: false
    },
    legend: {
      position: 'bottom',
      fontSize: '11px',
      fontFamily: 'Inter, sans-serif',
      labels: {
        colors: '#9ca3af',
      },
      markers: {
        width: 10,
        height: 10,
        radius: 2,
      },
      itemMargin: {
        horizontal: 10,
        vertical: 5,
      }
    },
    plotOptions: {
      polarArea: {
        rings: {
          strokeWidth: 1,
          strokeColor: '#374151',
        },
        spokes: {
          strokeWidth: 1,
          connectorColors: '#374151',
        },
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val, opts) => {
        return opts.w.globals.labels[opts.seriesIndex];
      },
      style: {
        fontSize: '11px',
        fontWeight: 700,
        fontFamily: 'Inter, sans-serif',
      },
      dropShadow: {
        enabled: false
      }
    },
    tooltip: {
      theme: "dark",
      style: {
        fontFamily: 'Inter, sans-serif',
      },
      y: {
        formatter: (val) => `${val} ${val === 1 ? 'vulnerability' : 'vulnerabilities'}`
      }
    },
    colors: colors,
    responsive: [{
      breakpoint: 480,
      options: {
        chart: { height: 320 },
        legend: { position: 'bottom' }
      }
    }]
  };

  return (
    <div className="w-full">
      <ReactApexChart options={options} series={severityValues} type="polarArea" height={380} />
    </div>
  );
};


