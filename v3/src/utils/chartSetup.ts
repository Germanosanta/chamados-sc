import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

/** Mesma paleta de tooltip/grid da V2 (mkBase(), dashboard/index.js). */
export const chartBaseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(26,31,54,0.95)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      titleColor: '#f0f4ff',
      bodyColor: '#8896b0',
      padding: 10,
      cornerRadius: 8,
      titleFont: { weight: 700 as const, size: 12 },
    },
  },
  scales: {
    x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8896b0' } },
    y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#8896b0' }, beginAtZero: true },
  },
};
