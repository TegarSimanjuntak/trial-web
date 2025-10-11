import React from 'react';
import DocumentManager from '../components/DocumentManager';

export default function AdminPage({ session }) {
  return (
    <div className="container">
      <div className="card">
        <h2>Admin Dashboard</h2>
        <DocumentManager session={session} />
      </div>
    </div>
  )
}
