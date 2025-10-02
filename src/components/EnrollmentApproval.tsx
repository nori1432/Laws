import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Phone,
  Mail,
  BookOpen,
  AlertTriangle,
  Search,
  Filter
} from 'lucide-react';

interface PendingEnrollment {
  id: number;
  enrollment_date: string;
  student: {
    id: number;
    name: string;
    date_of_birth: string | null;
  };
  parent: {
    id: number;
    name: string;
    phone: string;
    email: string;
  };
  user: {
    id: number;
    full_name: string;
    email: string;
    phone: string;
  };
  course: {
    id: number;
    name: string;
    description: string;
    pricing_type: string;
    session_price: number | null;
    monthly_price: number | null;
  };
  class: {
    id: number;
    name: string;
    schedule: string;
    max_students: number;
    current_enrollments: number;
  };
  payment_type: string;
  status: 'pending' | 'approved' | 'rejected';
}

const EnrollmentApproval: React.FC = () => {
  const [pendingEnrollments, setPendingEnrollments] = useState<PendingEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<PendingEnrollment | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    fetchPendingEnrollments();
  }, []);

  const fetchPendingEnrollments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/enrollments/pending');
      setPendingEnrollments(response.data.enrollments || []);
    } catch (error) {
      console.error('Failed to fetch pending enrollments:', error);
      toast.error('Failed to load pending enrollments');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (enrollmentId: number) => {
    try {
      setProcessing(enrollmentId);
      await axios.post(`/api/admin/enrollments/${enrollmentId}/approve`);
      toast.success('Enrollment approved successfully');
      fetchPendingEnrollments(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to approve enrollment:', error);
      toast.error(error.response?.data?.error || 'Failed to approve enrollment');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!selectedEnrollment) return;

    try {
      setProcessing(selectedEnrollment.id);
      await axios.post(`/api/admin/enrollments/${selectedEnrollment.id}/reject`, {
        reason: rejectionReason
      });
      toast.success('Enrollment rejected successfully');
      setShowRejectModal(false);
      setSelectedEnrollment(null);
      setRejectionReason('');
      fetchPendingEnrollments(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to reject enrollment:', error);
      toast.error(error.response?.data?.error || 'Failed to reject enrollment');
    } finally {
      setProcessing(null);
    }
  };

  const filteredEnrollments = pendingEnrollments.filter(enrollment =>
    enrollment.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    enrollment.course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    enrollment.parent.phone.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading pending enrollments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Users className="w-7 h-7 mr-3 text-blue-600" />
            Enrollment Approvals
          </h1>
          <p className="text-gray-600 mt-1">
            Review and approve pending student enrollments
          </p>
        </div>
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-medium">
          {pendingEnrollments.length} Pending
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by student name, course, or phone..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Enrollments List */}
      {filteredEnrollments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {pendingEnrollments.length === 0 ? 'No Pending Enrollments' : 'No Matching Enrollments'}
          </h3>
          <p className="text-gray-600">
            {pendingEnrollments.length === 0 
              ? 'All enrollments have been processed.' 
              : 'Try adjusting your search criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEnrollments.map((enrollment) => (
            <div key={enrollment.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {enrollment.user.full_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Student: {enrollment.student.name}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="w-4 h-4 mr-2" />
                          {enrollment.user.phone}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-4 h-4 mr-2" />
                          {enrollment.user.email}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="w-4 h-4 mr-2" />
                          Requested: {new Date(enrollment.enrollment_date).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <BookOpen className="w-4 h-4 mr-2" />
                          {enrollment.course.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          <strong>Section:</strong> {enrollment.class.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          <strong>Schedule:</strong> {enrollment.class.schedule}
                        </div>
                        <div className="text-sm text-gray-600">
                          <strong>Payment:</strong> {enrollment.payment_type === 'monthly' ? 'Monthly' : 'Per Session'}
                        </div>
                      </div>
                    </div>

                    {/* Class Capacity Info */}
                    <div className="flex items-center space-x-2 mb-4">
                      <span className="text-sm text-gray-600">Class Capacity:</span>
                      <span className={`text-sm font-medium ${
                        enrollment.class.current_enrollments >= enrollment.class.max_students
                          ? 'text-red-600'
                          : enrollment.class.current_enrollments >= enrollment.class.max_students * 0.8
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}>
                        {enrollment.class.current_enrollments}/{enrollment.class.max_students} enrolled
                      </span>
                      {enrollment.class.current_enrollments >= enrollment.class.max_students && (
                        <div className="flex items-center text-red-600">
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          <span className="text-xs">Class Full</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleApprove(enrollment.id)}
                      disabled={processing === enrollment.id || enrollment.class.current_enrollments >= enrollment.class.max_students}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center text-sm font-medium transition-colors"
                    >
                      {processing === enrollment.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Approve
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedEnrollment(enrollment);
                        setShowRejectModal(true);
                      }}
                      disabled={processing === enrollment.id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center text-sm font-medium transition-colors"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedEnrollment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reject Enrollment
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to reject the enrollment for <strong>{selectedEnrollment.user.full_name}</strong> 
              in <strong>{selectedEnrollment.course.name}</strong>?
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={3}
                required
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedEnrollment(null);
                  setRejectionReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || processing === selectedEnrollment?.id}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {processing === selectedEnrollment?.id ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Rejecting...
                  </div>
                ) : (
                  'Reject Enrollment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentApproval;