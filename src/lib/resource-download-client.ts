export function downloadResourceFile(resourceId: number) {
  const link = document.createElement("a");
  link.href = `/api/resources/${resourceId}/download`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
