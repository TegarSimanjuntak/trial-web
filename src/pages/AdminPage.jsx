// src/pages/AdminPage.jsx
import React from 'react';
import DocumentManager from '../components/DocumentManager';

export default function AdminPage({ session }) {
  return (
    <>
      <style>
        {`
          .fade-in-up {
            opacity: 0;
            transform: translateY(6px);
            animation: fadeInUp 0.35s ease-out forwards;
          }
          @keyframes fadeInUp {
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>

      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f3f4f6', // abu muda, tetap tema putih
          padding: '24px 16px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          className="fade-in-up"
          style={{
            width: '100%',
            maxWidth: 1000,
          }}
        >
          {/* Header */}
          <header
            style={{
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#111827',
                }}
              >
                Admin Dashboard
              </h1>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  color: '#6b7280',
                }}
              >
                Kelola dokumen sumber untuk Tutor Cerdas dari satu tempat.
              </p>
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 1,
                padding: '6px 10px',
                borderRadius: 999,
                backgroundColor: '#eef2ff',
                color: '#4f46e5',
                whiteSpace: 'nowrap',
              }}
            >
              Admin Mode
            </span>
          </header>

          {/* Card utama putih */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 18,
              boxShadow: '0 18px 40px rgba(15,23,42,0.08)',
              padding: '18px 18px 20px',
              border: '1px solid #e5e7eb',
            }}
          >
            {/* Kalau mau, judul kecil di dalam card */}
            <div
              style={{
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#111827',
                }}
              >
                Manajemen Dokumen
              </h2>
              <span
                style={{
                  fontSize: 11,
                  color: '#9ca3af',
                }}
              >
                Tambah, update, dan hapus dokumen basis pengetahuan.
              </span>
            </div>

            {/* Fitur inti: DocumentManager (TIDAK DIUBAH) */}
            <DocumentManager session={session} />
          </div>
        </div>
      </div>
    </>
  );
}
