'use client';

import styles from './Pagination.module.scss';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  
    if (totalPages <= 1) return null;
    const pages = [];
  
    const handlePrev = () => {
        if (currentPage > 1) onPageChange(currentPage - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) onPageChange(currentPage + 1);
    };

    for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
    }

    return (
        <div className={styles.pagination}>
            <button onClick={handlePrev} disabled={currentPage === 1}>
                Previous
            </button>
            {pages.map((page) => (
                <button key={page} className={page === currentPage ? styles.active : ''}
                onClick={() => onPageChange(page)}>
                    {page}
                </button>
            ))}
            <button onClick={handleNext} disabled={currentPage === totalPages}>
                Next
            </button>
        </div>
    );
}
