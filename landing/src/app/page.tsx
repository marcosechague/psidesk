export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        fontFamily: "Georgia, serif",
        background: "#FAF7F2",
        color: "#3A352F",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", margin: 0 }}>Psidesk</h1>
      <p style={{ fontSize: "1.1rem", opacity: 0.7 }}>Próximamente</p>
    </main>
  );
}
