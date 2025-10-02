import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Calendar, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  Filter,
  Search,
  Download,
  AlertTriangle,
  DollarSign,
  Activity,
  BarChart3
} from 'lucide-react';

interface AttendanceRecord {
  id: number;
  student_id: number;
  student_name: string;
  class_id: number;
  class_name: string;
  course_name: string;
  payment_type: string;
  payment_status: string;
  payment_amount: number;
  status: 'present' | 'absent' | 'late';
  attendance_date: string;
  marked_at: string;
  marked_by: number;
}

interface AttendanceSummary {
  total_records: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_rate: number;
}

interface PaymentDueStudent {
  student_id: number;
  student_name: string;
  course_id: number;
  course_name: string;
  sessions_attended: number;
  payment_status: string;
}

const AttendanceOverview: React.FC = () => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [recentActivity, setRecentActivity] = useState<AttendanceRecord[]>([]);
  const [paymentDueStudents, setPaymentDueStudents] = useState<PaymentDueStudent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAttendanceData();
  }, [dateFilter, statusFilter]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFilter) {
        const date = new Date(dateFilter);
        params.append('start_date', date.toISOString().split('T')[0]);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await axios.get(`/api/admin/attendance/overview?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const { attendance_records, summary, recent_activity, payment_due_students } = response.data;
      
      setAttendanceRecords(attendance_records);
      setSummary(summary);
      setRecentActivity(recent_activity.records);
      setPaymentDueStudents(payment_due_students);
    } catch (error: any) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = attendanceRecords.filter(record => 
    searchTerm === '' || 
    record.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'absent':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'late':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case 'present':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'absent':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'late':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const exportAttendanceData = () => {
    // Create CSV data
    const csvHeaders = ['Date', 'Student', 'Course', 'Class', 'Status', 'Payment Type', 'Payment Status', 'Payment Amount', 'Marked At'];
    const csvData = filteredRecords.map(record => [
      record.attendance_date,
      record.student_name,
      record.course_name,
      record.class_name,
      record.status,
      record.payment_type,
      record.payment_status,
      record.payment_amount?.toFixed(2) || '0.00',
      new Date(record.marked_at).toLocaleString()
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.join(','))
      .join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success('Attendance report exported successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-lg text-muted-foreground">Loading attendance data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Attendance Overview</h2>
          <p className="text-muted-foreground">Comprehensive attendance tracking and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={exportAttendanceData}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Statistics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Total Records</p>
                <p className="text-2xl font-bold text-blue-900">{summary.total_records}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Present</p>
                <p className="text-2xl font-bold text-green-900">{summary.present_count}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Absent</p>
                <p className="text-2xl font-bold text-red-900">{summary.absent_count}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Attendance Rate</p>
                <p className="text-2xl font-bold text-purple-900">{summary.attendance_rate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Payment Due Alerts */}
      {paymentDueStudents.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <h3 className="text-lg font-semibold text-amber-900">Payment Due Alerts</h3>
            <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">
              {paymentDueStudents.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paymentDueStudents.map((student, index) => (
              <div key={index} className="bg-white rounded-lg p-4 border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{student.student_name}</h4>
                  <DollarSign className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-sm text-gray-600 mb-1">{student.course_name}</p>
                <p className="text-xs text-amber-700 font-medium">
                  {student.sessions_attended}/4 sessions completed
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search students, courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border border-border">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Attendance Records</h3>
              <p className="text-sm text-muted-foreground">
                Showing {filteredRecords.length} of {attendanceRecords.length} records
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-4 font-medium text-foreground">Date</th>
                    <th className="text-left p-4 font-medium text-foreground">Student</th>
                    <th className="text-left p-4 font-medium text-foreground">Course</th>
                    <th className="text-left p-4 font-medium text-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-foreground">Type</th>
                    <th className="text-left p-4 font-medium text-foreground">Payment</th>
                    <th className="text-left p-4 font-medium text-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRecords.slice(0, 20).map((record) => (
                    <tr key={record.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4 text-sm text-foreground">
                        {new Date(record.attendance_date).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-sm font-medium text-foreground">
                        {record.student_name}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        <div>
                          <div className="font-medium">{record.course_name}</div>
                          <div className="text-xs">{record.class_name}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={getStatusBadge(record.status)}>
                          {getStatusIcon(record.status)}
                          <span className="ml-1 capitalize">{record.status}</span>
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          record.payment_type === 'monthly' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {record.payment_type === 'monthly' ? 'Monthly' : 'Session'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          record.payment_status === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : record.payment_status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          <DollarSign className="w-3 h-3 mr-1" />
                          {record.payment_status === 'paid' ? 'Paid' : record.payment_status === 'partial' ? 'Partial' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground font-mono">
                        {record.payment_amount ? `${record.payment_amount.toFixed(0)} DA` : '0 DA'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRecords.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Records Found</h3>
                  <p className="text-muted-foreground">Try adjusting your search criteria</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="bg-card rounded-xl border border-border">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Activity
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {recentActivity.slice(0, 5).map((record) => (
                <div key={record.id} className="flex items-center gap-3">
                  {getStatusIcon(record.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {record.student_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {record.course_name} • {new Date(record.marked_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceOverview;