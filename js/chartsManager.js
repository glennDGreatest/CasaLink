class ChartsManager {
    constructor() {
        this.charts = {};
        this.colors = {
            primary: '#162660',
            secondary: '#3498db',
            success: '#34A853',
            warning: '#FBBC04',
            danger: '#EA4335',
            info: '#17a2b8',
            purple: '#9334E6',
            teal: '#4ECDC4',
            lightBlue: '#D0E6FD',
            lightGray: '#F4F6F8'
        };
    }

    // initializeAllCharts optionally accepts a data object populated by ReportsManager
    initializeAllCharts(data = {}) {
        this.createRevenueTrendChart(data.financialReports);
        this.createPaymentMethodsChart(data.financialReports);
        this.createRevenuePerUnitChart(data.financialReports);
        this.createOccupancyChart(data.propertyReports);
        this.createLatePaymentsChart(data.financialReports);
        this.createMaintenanceCostsChart(data.tenantReports);
        this.createRetentionChart(data.tenantReports);
        this.createRentComparisonChart(data.propertyReports);
    }

    createRevenueTrendChart(financialData = {}) {
        const ctx = document.getElementById('revenueTrendChart').getContext('2d');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // fallback arrays if the ReportsManager did not supply them
        const labels = financialData.labels || months.slice(0, 6);
        const currentYear = financialData.currentYear || [72000, 78000, 82000, 79000, 86000, 84500].slice(0, labels.length);
        const previousYear = financialData.previousYear || [65000, 68000, 72000, 70000, 75000, 73000].slice(0, labels.length);

        this.charts.revenueTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Monthly Revenue',
                        data: currentYear,
                        borderColor: this.colors.primary,
                        backgroundColor: this.colors.primary + '20',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Previous Year',
                        data: previousYear,
                        borderColor: this.colors.secondary,
                        backgroundColor: this.colors.secondary + '20',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ₱${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString();
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });
    }

    createPaymentMethodsChart(financialData = {}) {
        const ctx = document.getElementById('paymentMethodsChart').getContext('2d');
        const labels = financialData.paymentMethods?.labels || ['GCash', 'Bank Transfer', 'Cash', 'Maya', 'Check'];
        const dataPoints = financialData.paymentMethods?.data || [45, 25, 15, 10, 5];
        
        this.charts.paymentMethods = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataPoints,
                    backgroundColor: [
                        this.colors.success,
                        this.colors.primary,
                        this.colors.warning,
                        this.colors.purple,
                        this.colors.danger
                    ],
                    borderWidth: 2,
                    borderColor: 'white'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed}%`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    createRevenuePerUnitChart(financialData = {}) {
        const ctx = document.getElementById('revenuePerUnitChart').getContext('2d');
        const labels = financialData.revenueByUnit?.labels || ['Unit 101', 'Unit 102', 'Unit 201', 'Unit 202', 'Unit 301', 'Unit 302'];
        const dataPoints = financialData.revenueByUnit?.data || [12500, 11800, 13200, 12700, 14000, 13500];
        
        this.charts.revenuePerUnit = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly Revenue',
                    data: dataPoints,
                    backgroundColor: [
                        this.colors.primary,
                        this.colors.secondary,
                        this.colors.success,
                        this.colors.warning,
                        this.colors.purple,
                        this.colors.teal
                    ],
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Revenue: ₱${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    createOccupancyChart(propertyData = {}) {
        const ctx = document.getElementById('occupancyChart').getContext('2d');
        const occupied = propertyData.occupancy?.occupied || 94;
        const vacant = propertyData.occupancy?.vacant || 6;
        
        this.charts.occupancy = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Occupied', 'Vacant'],
                datasets: [{
                    data: [occupied, vacant],
                    backgroundColor: [
                        this.colors.success,
                        this.colors.danger
                    ],
                    borderWidth: 3,
                    borderColor: 'white'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed}%`;
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    createLatePaymentsChart(financialData = {}) {
        const ctx = document.getElementById('latePaymentsChart').getContext('2d');
        const months = financialData.labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const values = financialData.data || [3, 5, 2, 4, 6, 2];
        
        this.charts.latePayments = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'Late Payments',
                    data: values,
                    backgroundColor: this.colors.danger,
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Late Payments'
                        }
                    }
                }
            }
        });
    }

    createMaintenanceCostsChart(tenantData = {}) {
        const ctx = document.getElementById('maintenanceCostsChart').getContext('2d');
        const labels = tenantData.labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const costs = tenantData.total || [1800, 2200, 1500, 1900, 2100, 2150];
        
        this.charts.maintenanceCosts = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Maintenance Costs',
                    data: costs,
                    borderColor: this.colors.warning,
                    backgroundColor: this.colors.warning + '20',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Cost: ₱${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    createRetentionChart(tenantData = {}) {
        const ctx = document.getElementById('retentionChart').getContext('2d');
        const renewed = tenantData.renewed || 78;
        const moved = tenantData.movedOut || 22;
        
        this.charts.retention = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Renewed', 'Moved Out'],
                datasets: [{
                    data: [renewed, moved],
                    backgroundColor: [
                        this.colors.success,
                        this.colors.danger
                    ],
                    borderWidth: 2,
                    borderColor: 'white'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed}%`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    createRentComparisonChart(propertyData = {}) {
        const ctx = document.getElementById('rentComparisonChart').getContext('2d');
        const labels = propertyData.rentComparison?.labels || ['Studio', '1BR', '2BR', '3BR'];
        const your = propertyData.rentComparison?.yourRent || [12000, 15000, 18000, 22000];
        const market = propertyData.rentComparison?.marketAverage || [11500, 14500, 17500, 21000];
        
        this.charts.rentComparison = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Your Rent',
                        data: your,
                        backgroundColor: this.colors.primary,
                        borderWidth: 0,
                        borderRadius: 6
                    },
                    {
                        label: 'Market Average',
                        data: market,
                        backgroundColor: this.colors.secondary,
                        borderWidth: 0,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ₱${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    // Method to update charts with new data (for future use)
    updateChartData(chartId, newData) {
        if (this.charts[chartId]) {
            this.charts[chartId].data = newData;
            this.charts[chartId].update();
        }
    }

    // Method to destroy charts (for cleanup)
    destroyAllCharts() {
        Object.values(this.charts).forEach(chart => {
            chart.destroy();
        });
        this.charts = {};
    }
}