import React, { useRef, useCallback, FormEvent, ReactNode } from "react";


export type FilePickerProps = { 
  onFileLoaded: (file: Blob) => void;
  buttonText?: ReactNode;
  disabled?: boolean;
}

export const FilePickerButton : React.FC<FilePickerProps> = ({ onFileLoaded, buttonText = "Open...", disabled }) => {
  const inputFileRef = useRef<HTMLInputElement>();

  const handlePickFile = useCallback(() => { 
    inputFileRef.current.click();
  }, []);
  
  const handleInputFileChanged = useCallback((e: FormEvent<HTMLInputElement>) => { 
    if(e.currentTarget.files.length <= 0) {
      return;
    }

    const first = e.currentTarget.files[0];
    onFileLoaded(first)
  }, [onFileLoaded]);

  return <>
    <input ref={inputFileRef} hidden type="file" accept=".svg,image/svg+xml" id="picker" onChange={handleInputFileChanged} />
    <button disabled={disabled} onClick={handlePickFile}>{buttonText}</button>
  </>;
}