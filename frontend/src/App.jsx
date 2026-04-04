import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ModernLogin from "./ModernLogin";
import ModernProjects from "./ModernProjects";
import ModernDashboard from "./ModernDashboard";
import VulnerabilitiesPage from "./components/Vulnerabilities/VulnerabilitiesPage";
import GraphsPage from "./GraphsPage";
import Scans from "./Scans";
import Screenshots from "./Screenshots";
import Settings from "./Settings";
import ProjectOverview from "./ProjectOverview";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import { ToastProvider } from "./contexts/ToastContext";
import Layout from "./components/Layout";
import ProjectLayout from "./components/ProjectLayout";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

const PrivateRoute = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/check-auth`, {
                    method: "GET",
                    credentials: "include", // Send the cookie with the request
                });

                if (response.ok) {
                    setIsAuthenticated(true);
                } else {
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("Error checking authentication:", error);
                setIsAuthenticated(false);
            }
        };

        checkAuth();
    }, []);

    if (isAuthenticated === null) {
        // Show a proper loading state while checking authentication
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent mx-auto mb-3"></div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                </div>
            </div>
        );
    }

    return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
    return (
        <QueryClientProvider client={queryClient}>
        <ThemeProvider>
            <ToastProvider>
            <SidebarProvider>
                <Router>
                    <Routes>
                        {/* Login Page - No Layout */}
                        <Route path="/login" element={<ModernLogin />} />

                        {/* Projects list (home) */}
                        <Route
                            path="/"
                            element={
                                <PrivateRoute>
                                    <Layout>
                                        <ModernProjects />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />

                        {/* Settings page */}
                        <Route
                            path="/settings"
                            element={
                                <PrivateRoute>
                                    <Layout>
                                        <Settings />
                                    </Layout>
                                </PrivateRoute>
                            }
                        />

                        {/* All project-scoped routes */}
                        <Route
                            path="/project/:projectId"
                            element={
                                <PrivateRoute>
                                    <Layout>
                                        <ProjectLayout />
                                    </Layout>
                                </PrivateRoute>
                            }
                        >
                            <Route index element={<ProjectOverview />} />
                            <Route path="assets" element={<ModernDashboard />} />
                            <Route path="vulnerabilities" element={<VulnerabilitiesPage />} />
                            <Route path="scans" element={<Scans />} />
                            <Route path="screenshots" element={<Screenshots />} />
                            <Route path="analytics" element={<GraphsPage />} />
                        </Route>

                        {/* Legacy redirects for old bookmarks */}
                        <Route path="/dashboard" element={<Navigate to="/" replace />} />
                        <Route path="/graphs" element={<Navigate to="/" replace />} />

                        {/* Redirect unknown paths */}
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </Router>
            </SidebarProvider>
            </ToastProvider>
        </ThemeProvider>
        </QueryClientProvider>
    );
}

export default App;
