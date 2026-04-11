import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Spinner, Switch } from '@fluentui/react-components';
import {
  Add24Regular,
  ArrowUpload24Regular,
  ArrowSync24Regular,
  Search24Regular,
  Edit24Regular,
  Delete24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
} from '@fluentui/react-icons';
import {
  getDocs,
  getCountFromServer,
  query,
  where,
  limit,
  limitToLast,
  startAfter,
  endBefore,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { useCompany } from '../../contexts/companyContext';
import {
  getCompanyCollection,
  getCompanyDoc,
  DB_NAMES,
} from '../../services/firestoreHelpers';
import { useDebounce } from '../../services/globalUtils';
import ProductDialog from './productDialog';
import ImportProducts from './importProducts';
import './style.css';

const PAGE_SIZE = 50;

export default function ProductsListScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const debouncedSearch = useDebounce(searchText, 400);

  // Cursor-based pagination state
  const [firstSnap, setFirstSnap] = useState(null);
  const [lastSnap, setLastSnap] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [pageHistory, setPageHistory] = useState([]);
  const [pageNum, setPageNum] = useState(1);
  const [totalCount, setTotalCount] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const { currentCompanyId } = useCompany();

  const colRef = useCallback(
    () => getCompanyCollection(currentCompanyId, DB_NAMES.PRODUCTS),
    [currentCompanyId],
  );

  const processSnapshot = (snap) => {
    const { docs } = snap;
    if (docs.length === 0) {
      setProducts([]);
      setFirstSnap(null);
      setLastSnap(null);
      setHasNext(false);
      return;
    }
    setFirstSnap(docs[0]);
    setLastSnap(docs[docs.length - 1]);
    setHasNext(docs.length === PAGE_SIZE);
    setProducts(docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchCount = useCallback(async () => {
    try {
      const snap = await getCountFromServer(query(colRef()));
      setTotalCount(snap.data().count);
    } catch {
      setTotalCount(null);
    }
  }, [colRef]);

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(colRef(), limit(PAGE_SIZE)));
      processSnapshot(snap);
      setPageNum(1);
      setPageHistory([]);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
    setLoading(false);
  }, [colRef]);

  const fetchNextPage = async () => {
    if (!lastSnap || loading) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(colRef(), startAfter(lastSnap), limit(PAGE_SIZE)),
      );
      if (snap.docs.length > 0) {
        setPageHistory((prev) => [...prev, firstSnap]);
        processSnapshot(snap);
        setPageNum((p) => p + 1);
      }
    } catch (err) {
      console.error('Error fetching next page:', err);
    }
    setLoading(false);
  };

  const fetchPrevPage = async () => {
    if (pageHistory.length === 0 || loading) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(colRef(), endBefore(firstSnap), limitToLast(PAGE_SIZE)),
      );
      if (snap.docs.length > 0) {
        setPageHistory((prev) => prev.slice(0, -1));
        processSnapshot(snap);
        setPageNum((p) => p - 1);
      }
    } catch (err) {
      console.error('Error fetching prev page:', err);
    }
    setLoading(false);
  };

  // Search uses prefix queries
  const fetchSearch = useCallback(async () => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      fetchFirstPage();
      return;
    }
    setLoading(true);
    try {
      const ref = colRef();
      const upper = debouncedSearch.toUpperCase();
      const capitalised =
        debouncedSearch.charAt(0).toUpperCase() +
        debouncedSearch.slice(1).toLowerCase();

      const prefixQueries = [
        { field: 'Name', prefix: upper },
        { field: 'name', prefix: capitalised },
        { field: 'name', prefix: debouncedSearch },
      ];

      const seen = new Set();
      const merged = [];

      for (const { field, prefix } of prefixQueries) {
        try {
          const end = `${prefix}\uf8ff`;
          const q = query(
            ref,
            where(field, '>=', prefix),
            where(field, '<=', end),
            limit(200),
          );
          const snap = await getDocs(q);
          snap.docs.forEach((d) => {
            if (!seen.has(d.id)) {
              seen.add(d.id);
              merged.push({ id: d.id, ...d.data() });
            }
          });
        } catch {
          // field/index may not exist
        }
      }

      setProducts(merged);
      setFirstSnap(null);
      setLastSnap(null);
      setHasNext(false);
      setPageHistory([]);
      setPageNum(1);
    } catch (err) {
      console.error('Error searching products:', err);
    }
    setLoading(false);
  }, [colRef, debouncedSearch, fetchFirstPage]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    fetchSearch();
  }, [fetchSearch]);

  const handleDelete = async (product) => {
    if (
      !window.confirm(
        `Delete "${product.name || product.Name}"? This cannot be undone.`,
      )
    )
      return;
    try {
      const ref = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.PRODUCTS,
        product.id,
      );
      await deleteDoc(ref);
      fetchFirstPage();
      fetchCount();
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  const handleToggleActive = async (product) => {
    try {
      const ref = getCompanyDoc(
        currentCompanyId,
        DB_NAMES.PRODUCTS,
        product.id,
      );
      const newActive = product.isActive === false;
      await updateDoc(ref, { isActive: newActive });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, isActive: newActive } : p,
        ),
      );
    } catch (err) {
      console.error('Error toggling active:', err);
    }
  };

  const openEdit = (product) => {
    setEditProduct(product);
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditProduct(null);
    setDialogOpen(true);
  };

  const handleRefresh = () => {
    fetchFirstPage();
    fetchCount();
  };

  const isSearching = debouncedSearch && debouncedSearch.length >= 2;
  const displayProducts = showInactive
    ? products
    : products.filter((p) => p.isActive !== false);

  const startIdx = (pageNum - 1) * PAGE_SIZE;

  return (
    <div className="products-container">
      <div className="products-header">
        <h2>Products</h2>
        <div className="products-header-actions">
          <Button
            icon={<ArrowSync24Regular />}
            appearance="subtle"
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            icon={<ArrowUpload24Regular />}
            appearance="subtle"
            onClick={() => setImportOpen(true)}
          >
            Import CSV / Excel
          </Button>
          <Button
            icon={<Add24Regular />}
            appearance="primary"
            onClick={openAdd}
          >
            Add Product
          </Button>
        </div>
      </div>

      <div className="products-search-row">
        <Input
          className="search-input"
          contentBefore={<Search24Regular />}
          placeholder="Search products by name..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Switch
          checked={showInactive}
          onChange={(_, d) => setShowInactive(d.checked)}
          label="Show inactive"
        />
        {totalCount !== null && (
          <span
            style={{
              fontSize: 13,
              color: 'var(--colorNeutralForeground3)',
              whiteSpace: 'nowrap',
            }}
          >
            {totalCount} total products
          </span>
        )}
      </div>

      <div className="products-table-wrapper">
        {loading ? (
          <div className="products-loading">
            <Spinner label="Loading products..." />
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="products-empty">
            <p>No products found.</p>
            <p style={{ fontSize: 13 }}>
              Add products manually or import from a CSV/Excel file.
            </p>
          </div>
        ) : (
          <table className="products-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Name</th>
                <th>Company</th>
                <th>Pack Size</th>
                <th className="col-mrp">MRP</th>
                <th>Composition</th>
                <th className="col-active">Status</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayProducts.map((p, idx) => (
                <tr key={p.id} onDoubleClick={() => openEdit(p)}>
                  <td
                    style={{
                      color: 'var(--colorNeutralForeground3)',
                      fontSize: 12,
                    }}
                  >
                    {startIdx + idx + 1}
                  </td>
                  <td>{p.name || p.Name || '—'}</td>
                  <td>{p.company || p.Company || p.brand || '—'}</td>
                  <td>{p.packSize || p.Pack || p.pack || '—'}</td>
                  <td className="col-mrp">
                    {(p.mrp || p.MRP || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>{p.composition || p.Composition || '—'}</td>
                  <td className="col-active">
                    <span
                      className={
                        p.isActive !== false ? 'badge-active' : 'badge-inactive'
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(p);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {p.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="col-actions">
                    <Button
                      icon={<Edit24Regular />}
                      appearance="subtle"
                      size="small"
                      onClick={() => openEdit(p)}
                    />
                    <Button
                      icon={<Delete24Regular />}
                      appearance="subtle"
                      size="small"
                      onClick={() => handleDelete(p)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isSearching && (
        <div className="products-pagination">
          <Button
            icon={<ChevronLeft24Regular />}
            appearance="subtle"
            size="small"
            disabled={pageNum <= 1 || loading}
            onClick={fetchPrevPage}
          >
            Previous
          </Button>

          <span className="pagination-info">Page {pageNum}</span>

          <Button
            icon={<ChevronRight24Regular />}
            iconPosition="after"
            appearance="subtle"
            size="small"
            disabled={!hasNext || loading}
            onClick={fetchNextPage}
          >
            Next
          </Button>
        </div>
      )}

      {isSearching && displayProducts.length > 0 && (
        <div className="products-pagination">
          <span className="pagination-info">
            {displayProducts.length} result
            {displayProducts.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <ProductDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        product={editProduct}
        onSaved={handleRefresh}
      />

      <ImportProducts
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleRefresh}
      />
    </div>
  );
}
