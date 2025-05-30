import { prisma } from "../lib/prisma"


export async function recalculateBalance(sourceId: string, initialAmount?: number): Promise<number> {
  // const source = await prisma.source.findUnique({ where: { id: sourceId } })
  // if (!source) throw new Error('Source not found')

  // const initialAmount = source.initialAmount || 0

  // Total pemasukan (pemasukan langsung)
  const pemasukan = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      sourceId,
      type: { id: 'income-type' },
    },
  })

  // Total pengeluaran
  const pengeluaran = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      sourceId,
      type: { id: 'expense-type' },
    },
  })

  // Transfer keluar (dari source ini)
  const transferOut = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      sourceId,
      type: { name: 'Transfer',  },
      category: { id: 'out-trans-cat' },
    },
  })

  // Transfer masuk (ke source ini)
  const transferIn = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      sourceId,
      type: { name: 'Transfer' },
      category: { id: 'in-trans-cat' },
    },
  })

  const totalPemasukan = pemasukan._sum.amount || 0
  const totalPengeluaran = pengeluaran._sum.amount || 0
  const totalTransferOut = transferOut._sum.amount || 0
  const totalTransferIn = transferIn._sum.amount || 0

  console.log(
    `Initial Amount: ${initialAmount}, Total Pemasukan: ${totalPemasukan}, Total Transfer In: ${totalTransferIn}, Total Pengeluaran: ${totalPengeluaran}, Total Transfer Out: ${totalTransferOut}`);

    
  const newBalance = (initialAmount ?? 0) + totalPemasukan + totalTransferIn - totalPengeluaran - totalTransferOut;
  
  console.log(newBalance);

  return newBalance
}
