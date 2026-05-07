// app/manager/productivity/page.tsx
'use client';

import { useEffect, useState } from "react";
import Link from 'next/link';

type ProductivityData = {
  employee_id: number;
  productivity_score: number;
  employees: {
    first_name: string;
    last_name: string;
  };
};

export default function ProductivityDashboard() {
  const [data, setData] = useState<ProductivityData[]>([]);

  useEffect(() => {
    fetch("/api/productivity")
      .then(res => res.json())
      .then((rawData) => {
        // Remove duplicate employee_id (keeps highest score)
        const uniqueMap = new Map<number, ProductivityData>();
        rawData.forEach((item: ProductivityData) => {
          if (!uniqueMap.has(item.employee_id)) {
            uniqueMap.set(item.employee_id, item);
          }
        });
        setData(Array.from(uniqueMap.values()));
      })
      .catch(err => console.error("Failed to fetch productivity:", err));
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Work From Home Productivity Tracker</h1>
          <p className="text-gray-600 text-lg mt-2">Real-time hybrid team performance • Powered by Supabase</p>
        </div>
        <Link
          href="/manager"
          className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-medium hover:bg-black transition flex items-center gap-2"
        >
          ← Back to Manager Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {data.length === 0 ? (
          <div className="col-span-full text-center py-20 text-gray-500 text-xl">
            No productivity data yet. Add records to productivity_metrics table.
          </div>
        ) : (
          data.map((emp) => {
            const score = Math.round(emp.productivity_score);
            const barColor = score >= 85 ? 'bg-emerald-500' : score >= 75 ? 'bg-amber-500' : 'bg-orange-500';
            const textColor = score >= 85 ? 'text-emerald-600' : score >= 75 ? 'text-amber-600' : 'text-orange-600';

            return (
              <div
                key={emp.employee_id}
                className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 hover:shadow-3xl transition-all"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900">
                      {emp.employees.first_name} {emp.employees.last_name}
                    </h3>
                    <p className="text-gray-500 text-sm">ID: {emp.employee_id}</p>
                  </div>
                  <div className={`text-6xl font-bold ${textColor}`}>
                    {score}<span className="text-3xl align-super">%</span>
                  </div>
                </div>

                <div className="h-4 bg-gray-100 rounded-full overflow-hidden mb-8">
                  <div
                    className={`h-4 transition-all duration-700 ${barColor}`}
                    style={{ width: `${score}%` }}
                  />
                </div>

                <div className="mt-8 text-center text-xs text-gray-400">
                  Score calculated from login time, tasks &amp; sessions
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}