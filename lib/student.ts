export const normalizeStudentName = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()

export const normalizeStudentNisn = (value: string) =>
  String(value ?? "").replace(/\D+/g, "").trim()

export const getComparableStudentName = (value: string) =>
  normalizeStudentName(value).replace(/\s+/g, "")

export const matchesStudentSearch = (name: string, query: string) =>
  getComparableStudentName(name).includes(getComparableStudentName(query))

export const compareStudentNames = (left?: string | null, right?: string | null) =>
  String(left || "").localeCompare(String(right || ""), "id-ID", {
    sensitivity: "base",
  })

const getEditDistance = (left: string, right: string) => {
  const rows = left.length + 1
  const cols = right.length + 1
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = left[row - 1] === right[col - 1] ? 0 : 1

      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + substitutionCost
      )
    }
  }

  return matrix[rows - 1][cols - 1]
}

export const isStudentNameVerySimilar = (left: string, right: string) => {
  const normalizedLeft = getComparableStudentName(left)
  const normalizedRight = getComparableStudentName(right)

  if (!normalizedLeft || !normalizedRight) {
    return false
  }

  return getEditDistance(normalizedLeft, normalizedRight) <= 1
}
