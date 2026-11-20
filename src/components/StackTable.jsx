/**
 * Mobilde satırları kart olarak gösteren, masaüstünde klasik tablo.
 * Her <td> için data-label="Sütun Adı" ekleyin.
 * İşlem sütunları: data-label="" className="stack-actions ..."
 * Masaüstü-only hücreler: className="stack-hide-mobile"
 */
export function StackTableWrap({ children }) {
  return <div className="w-full max-w-full overflow-x-clip md:overflow-x-auto">{children}</div>
}

export function stackTableClass(extra = '') {
  return `stack-table w-full max-w-full text-sm ${extra}`.trim()
}
