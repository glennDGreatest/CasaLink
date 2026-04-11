class PredictionCharts {
    constructor(chartsManager) {
        this.chartsManager = chartsManager;
        this.predictionCharts = new Map();
    }

    // Initialize all prediction charts
    async initializePredictionCharts(predictiveData) {
        await this.createRevenueForecastChart(predictiveData.revenueForecast);
        await this.createRevenueForecastMiniChart(predictiveData.revenueForecast);
        this.updatePredictionCards(predictiveData);
    }

    // Revenue forecast with historical data
    async createRevenueForecastChart(revenueData) {
        const ctx = document.getElementById('revenueForecastChart');
        if (!ctx) return;

        let historicalData = [];
        try {
            if (window.reportsManager && window.reportsManager.predictiveAnalytics && typeof window.reportsManager.predictiveAnalytics.getHistoricalRevenueData === 'function') {
                historicalData = await window.reportsManager.predictiveAnalytics.getHistoricalRevenueData();
            }
        } catch (err) {
            console.warn('Could not load actual historical revenue data:', err);
        }

        if (!historicalData || !historicalData.length) {
            historicalData = [];
        }
        
        const historicalLabels = historicalData.map(d => {
            const [year, month] = String(d.month || '').split('-');
            const monthIndex = Number(month);
            if (!isNaN(monthIndex)) {
                return new Date(parseInt(year), monthIndex).toLocaleDateString('en-US', { month: 'short' });
            }
            return String(d.month || '').slice(0, 3);
        });

        const predictionLabels = Array.isArray(revenueData?.predictions) ? revenueData.predictions.map((_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() + i + 1);
            return date.toLocaleDateString('en-US', { month: 'short' });
        }) : [];
        if (!historicalData.length && !predictionLabels.length) {
            // Render a mock illustrative chart so landlord sees expected UI
            try {
                const wrapper = ctx.parentNode;
                ctx.style.display = '';

                const mockLabels = [];
                const mockData = [];
                for (let i = 5; i >= 0; i--) {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    mockLabels.push(d.toLocaleDateString('en-US', { month: 'short' }));
                    mockData.push(50000 + Math.round(Math.random() * 20000) - 10000);
                }
                const mockPreds = [mockData[mockData.length - 1] + 2000, mockData[mockData.length - 1] + 5000, mockData[mockData.length - 1] + 8000];

                if (this.predictionCharts.has('revenueTrend')) {
                    this.predictionCharts.get('revenueTrend').destroy();
                }

                // compute next-month labels (three months)
                const nextMonthLabels = [1,2,3].map(i => {
                    const d = new Date(); d.setMonth(d.getMonth() + i);
                    return d.toLocaleDateString('en-US', { month: 'short' });
                });

                this.predictionCharts.set('revenueTrend', new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: [...mockLabels, ...nextMonthLabels],
                        datasets: [
                            {
                                label: 'Historical (mock)',
                                data: [...mockData, ...Array(3).fill(null)],
                                borderColor: 'rgba(107,114,128,0.9)',
                                backgroundColor: 'rgba(107,114,128,0.08)',
                                borderWidth: 2,
                                fill: false,
                                tension: 0.3
                            },
                            {
                                label: 'Forecast (mock)',
                                data: [...Array(mockData.length).fill(null), ...mockPreds],
                                borderColor: 'rgba(59,130,246,0.9)',
                                backgroundColor: 'rgba(59,130,246,0.08)',
                                borderWidth: 2,
                                borderDash: [6, 4],
                                fill: false,
                                tension: 0.3
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: true },
                            tooltip: { callbacks: { label: function(context) { return `${context.dataset.label}: ₱${context.parsed.y?.toLocaleString() || 'N/A'}`; } } }
                        },
                        scales: {
                            y: { ticks: { callback: function(value){ return '₱' + value.toLocaleString(); } } }
                        }
                    }
                }));

                // show a clear banner that this is mock/illustration only
                if (wrapper) {
                    let banner = wrapper.querySelector('.mock-chart-banner');
                    if (!banner) {
                        banner = document.createElement('div');
                        banner.className = 'mock-chart-banner';
                        banner.style.marginTop = '8px';
                        banner.style.fontSize = '12px';
                        banner.style.color = '#9ca3af';
                        banner.style.textAlign = 'center';
                        banner.textContent = 'Mock chart — illustration only. Collect historical payments to see real forecasts.';
                        wrapper.appendChild(banner);
                    } else {
                        banner.style.display = '';
                    }
                }
            } catch (err) {
                console.warn('Could not render mock revenue forecast chart:', err);
                const wrapper = ctx.parentNode;
                if (wrapper) {
                    ctx.style.display = 'none';
                    let message = wrapper.querySelector('.chart-no-data');
                    if (!message) {
                        message = document.createElement('div');
                        message.className = 'chart-no-data';
                        message.style.padding = '24px';
                        message.style.textAlign = 'center';
                        message.style.color = '#666';
                        message.style.fontSize = '14px';
                        wrapper.appendChild(message);
                    }
                    message.textContent = 'Insufficient historical revenue data to render the forecast chart.';
                }
            }
            return;
        }
        // Destroy existing chart if it exists
        if (this.predictionCharts.has('revenueTrend')) {
            this.predictionCharts.get('revenueTrend').destroy();
        }

        this.predictionCharts.set('revenueTrend', new Chart(ctx, {
            type: 'line',
            data: {
                labels: [...historicalLabels.slice(-6), ...predictionLabels.slice(0, 3)],
                datasets: [
                    {
                        label: 'Historical Revenue',
                        data: [...historicalData.slice(-6).map(d => d.revenue), ...Array(3).fill(null)],
                        borderColor: this.chartsManager.colors.primary,
                        backgroundColor: this.chartsManager.colors.primary + '20',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Revenue Forecast',
                        data: [...Array(historicalData.slice(-6).length).fill(null), ...revenueData.predictions.slice(0, 3)],
                        borderColor: this.chartsManager.colors.success,
                        backgroundColor: this.chartsManager.colors.success + '20',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4
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
                                return `${context.dataset.label}: ₱${context.parsed.y?.toLocaleString() || 'N/A'}`;
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            forecastLine: {
                                type: 'line',
                                xMin: historicalData.slice(-6).length - 0.5,
                                xMax: historicalData.slice(-6).length - 0.5,
                                borderColor: 'rgba(255, 0, 0, 0.3)',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: 'Forecast Start',
                                    position: 'end',
                                    backgroundColor: 'rgba(255, 0, 0, 0.1)'
                                }
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
                        }
                    }
                }
            }
        }));
    }

    // Mini chart for the prediction card
    createRevenueForecastMiniChart(revenueData) {
        const ctx = document.getElementById('revenueForecastMiniChart');
        if (!ctx) return;

        const labels = revenueData.predictions.slice(0, 3).map((_, i) => `M${i + 1}`);
        
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: revenueData.predictions.slice(0, 3),
                    borderColor: '#2e7d32',
                    backgroundColor: 'rgba(46, 125, 50, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#2e7d32'
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
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                }
            }
        });
    }

    // Update the prediction cards with real data
    updatePredictionCards(predictiveData) {
        // Update revenue card
        const nextMonthRevenue = document.getElementById('nextMonthRevenue');
        const revenueGrowthRate = document.getElementById('revenueGrowthRate');
        
        if (nextMonthRevenue) {
            nextMonthRevenue.textContent = predictiveData.revenueForecast.nextMonthPrediction.toLocaleString();
        }
        if (revenueGrowthRate) {
            revenueGrowthRate.textContent = `+${predictiveData.revenueForecast.growthRate}%`;
        }

        // Update occupancy card
        const nextMonthOccupancy = document.getElementById('nextMonthOccupancy');
        const atRiskUnits = document.getElementById('atRiskUnits');
        
        if (nextMonthOccupancy) {
            nextMonthOccupancy.textContent = predictiveData.occupancyTrend.predictions[0];
        }
        if (atRiskUnits) {
            atRiskUnits.textContent = predictiveData.occupancyTrend.atRiskUnits;
        }

        // Update maintenance card
        const nextMonthMaintenance = document.getElementById('nextMonthMaintenance');
        if (nextMonthMaintenance) {
            nextMonthMaintenance.textContent = predictiveData.maintenanceCosts.monthlyPredictions[0].toLocaleString();
        }
    }

    // Helper method to get historical data
    async getHistoricalRevenueData() {
        // This would typically come from your data manager
        // For now, return sample data
        return [
            { month: '2024-1', revenue: 72000 },
            { month: '2024-2', revenue: 78000 },
            { month: '2024-3', revenue: 82000 },
            { month: '2024-4', revenue: 79000 },
            { month: '2024-5', revenue: 86000 },
            { month: '2024-6', revenue: 84500 }
        ];
    }

    // Cleanup method
    destroyAll() {
        this.predictionCharts.forEach(chart => chart.destroy());
        this.predictionCharts.clear();
    }
}

window.PredictionCharts = PredictionCharts;

