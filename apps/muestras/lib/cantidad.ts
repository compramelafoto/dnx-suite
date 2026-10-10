/** "1 obra", "3 obras": el número con la palabra en singular o plural. */
export const cantidad = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
