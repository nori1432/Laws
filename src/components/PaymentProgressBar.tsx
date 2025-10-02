import React from 'react';

interface PaymentProgressBarProps {
  sessionsAttended: number;
  sessionsRequired: number;
  paymentStatus: 'pending' | 'paid';
  className?: string;
}

const PaymentProgressBar: React.FC<PaymentProgressBarProps> = ({
  sessionsAttended,
  sessionsRequired,
  paymentStatus,
  className = ''
}) => {
  const progressPercentage = Math.min((sessionsAttended / sessionsRequired) * 100, 100);
  const isComplete = sessionsAttended >= sessionsRequired;
  const isPaid = paymentStatus === 'paid';

  return (
    <div className={`payment-progress-bar ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          Monthly Progress
        </span>
        <span className="text-sm text-gray-600">
          {sessionsAttended}/{sessionsRequired} sessions
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${
            isPaid
              ? 'bg-green-500'
              : isComplete
                ? 'bg-blue-500'
                : 'bg-orange-400'
          }`}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-xs">
        <span className={`font-medium ${
          isPaid
            ? 'text-green-600'
            : isComplete
              ? 'text-blue-600'
              : 'text-orange-600'
        }`}>
          {isPaid
            ? 'Payment Completed'
            : isComplete
              ? 'Ready for Payment'
              : `${sessionsRequired - sessionsAttended} sessions remaining`
          }
        </span>
        <span className="text-gray-500">
          {Math.round(progressPercentage)}%
        </span>
      </div>
    </div>
  );
};

export default PaymentProgressBar;