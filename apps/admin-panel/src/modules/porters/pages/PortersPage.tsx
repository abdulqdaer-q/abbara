import React, { useState } from 'react';
import { CheckCircle, XCircle, Eye, Clock } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export const PortersPage: React.FC = () => {
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = trpc.porters.getPendingDocuments.useQuery({
    page,
    limit: 10,
  });

  const verifyDocumentMutation = trpc.porters.verifyDocument.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleVerify = async (porterId: string, documentId: string, approved: boolean) => {
    const action = approved ? 'approve' : 'reject';
    const notes = prompt(`Please provide notes for ${action}ing this document:`);

    if (notes !== null) {
      await verifyDocumentMutation.mutateAsync({
        porterId,
        documentId,
        verificationStatus: approved ? 'APPROVED' : 'REJECTED',
        reviewNotes: notes || `Document ${action}ed by admin`,
      });
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DRIVERS_LICENSE: "Driver's License",
      VEHICLE_REGISTRATION: 'Vehicle Registration',
      INSURANCE: 'Insurance',
      BACKGROUND_CHECK: 'Background Check',
      PROFILE_PHOTO: 'Profile Photo',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Porter Verification</h1>
          <p className="text-gray-600 mt-1">Review and verify porter documents</p>
        </div>
        <div className="text-sm text-gray-500">
          {data?.pagination && `${data.pagination.totalItems} pending documents`}
        </div>
      </div>

      {data?.pagination && data.pagination.totalItems > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          <div className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            <span className="font-medium">
              {data.pagination.totalItems} document{data.pagination.totalItems !== 1 ? 's' : ''} awaiting review
            </span>
          </div>
        </div>
      )}

      <div className="card">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
            Error loading documents: {error.message}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading pending documents...</p>
          </div>
        ) : data?.documents.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All caught up!</h3>
            <p className="text-gray-500">No pending porter documents to review.</p>
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Porter ID</th>
                  <th>Document Type</th>
                  <th>Document URL</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.documents.map((doc: any) => (
                  <tr key={doc.id}>
                    <td className="font-mono text-sm">{doc.porterId.slice(0, 8)}...</td>
                    <td>
                      <span className="font-medium">{getDocumentTypeLabel(doc.documentType)}</span>
                    </td>
                    <td className="text-sm">
                      {doc.documentUrl ? (
                        <a
                          href={doc.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 flex items-center"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Document
                        </a>
                      ) : (
                        <span className="text-gray-400">No URL</span>
                      )}
                    </td>
                    <td className="text-sm text-gray-600">
                      {new Date(doc.submittedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-600">
                        {doc.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleVerify(doc.porterId, doc.id, true)}
                          className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                          disabled={verifyDocumentMutation.isLoading}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleVerify(doc.porterId, doc.id, false)}
                          className="flex items-center px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          disabled={verifyDocumentMutation.isLoading}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data?.pagination && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-gray-500">
                  Page {data.pagination.currentPage} of {data.pagination.totalPages}
                </div>
                <div className="flex space-x-2">
                  <button
                    className="btn btn-secondary"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={page === data.pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
