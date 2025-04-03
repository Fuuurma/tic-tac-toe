import React from "react";

const UserMenuPopover = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon">
          <User className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48">
        <p className="text-sm font-medium">Hello, {username || "Guest"}</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {colors.map((color) => (
            <button
              key={color}
              className="w-6 h-6 rounded-full border-2"
              style={{
                backgroundColor: color,
                borderColor: selectedColor === color ? "black" : "transparent",
              }}
              onClick={() => setSelectedColor(color)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UserMenuPopover;
