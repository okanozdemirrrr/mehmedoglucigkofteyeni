/**
 * Mobilde satırları kart olarak gösteren, masaüstünde klasik tablo.
 * Her <td> için data-label="Sütun Adı" ekleyin.
 * İşlem sütunları: data-label="" className="stack-actions ..."
 */
export function StackTableWrap({ children }) {
  return <div className="md:overflow-x-auto">{children}</div>
}

export function stackTableClass(extra = '') {
  return `stack-table w-full text-sm ${extra}`.trim()
}
