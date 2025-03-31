import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function Home() {
  const [socket, setSocket] = useState(null);
  const [board, setBoard] = useState(Array(9).fill(null)); // 3x3 board
  const [player, setPlayer] = useState("X");

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on("updateBoard", (newBoard) => {
      setBoard(newBoard);
    });

    return () => newSocket.disconnect();
  }, []);

  const handleClick = (index) => {
    if (!board[index]) {
      const newBoard = [...board];
      newBoard[index] = player;
      setBoard(newBoard);
      socket.emit("move", newBoard); // Send move to server
    }
  };

  return (
    <div className="flex flex-col items-center mt-10">
      <h1 className="text-2xl mb-4">Tic Tac Toe</h1>
      <div className="grid grid-cols-3 gap-2">
        {board.map((cell, i) => (
          <button
            key={i}
            className="w-20 h-20 border text-2xl flex items-center justify-center"
            onClick={() => handleClick(i)}
          >
            {cell}
          </button>
        ))}
      </div>
    </div>
  );
}
